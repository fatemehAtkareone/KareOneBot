import type { Context } from "grammy";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { h, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { displayName } from "@/lib/users";
import { setState, clearState } from "@/lib/redis";
import { log } from "@/lib/logger";

interface RejectInputState {
  flow: "reject_reason";
  approvalStepId: number;
}

/** /approval <task_id> @user1 [@user2 ...] [all]    — start an approval flow */
export async function handleApprovalRequest(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");

  const idArg = args[0];
  const taskId = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  const userArgs = args.slice(1).filter((a) => a.startsWith("@"));
  const allMode = args.slice(1).includes("all");

  if (!Number.isInteger(taskId) || userArgs.length === 0) {
    await ctx.reply(
      "Usage: <code>/approval &lt;task_id&gt; @user1 @user2 ... [all]</code>\n" +
        "<i>Default is 'any' (any one approver suffices). Add the word 'all' to require everyone.</i>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const task = await db()
    .select({ id: schema.tasks.id, title: schema.tasks.title })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId)))
    .limit(1);
  if (!task[0]) return void ctx.reply(`Task #${taskId} not found.`);

  // Resolve usernames → user ids in this workspace
  const usernames = userArgs.map((u) => u.slice(1));
  const approvers = await db()
    .select({ id: schema.users.id, telegramId: schema.users.telegramId, uname: schema.users.telegramUsername })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(
      and(
        eq(schema.memberships.workspaceId, m.workspaceId),
        inArray(schema.users.telegramUsername, usernames)
      )
    );

  if (approvers.length === 0) {
    await ctx.reply("None of the listed users are in this workspace.");
    return;
  }

  const requiredCount = allMode ? approvers.length : 1;

  const [approval] = await db()
    .insert(schema.approvals)
    .values({
      taskId,
      type: allMode ? "all" : "any",
      requiredCount,
      requestedBy: m.userId,
    })
    .returning({ id: schema.approvals.id });

  await db()
    .insert(schema.approvalSteps)
    .values(approvers.map((a) => ({ approvalId: approval!.id, approverUserId: a.id })));

  await db()
    .update(schema.tasks)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));

  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "create",
    entity: "approval",
    entityId: approval!.id,
    diff: { taskId, type: allMode ? "all" : "any", required: requiredCount, approvers: approvers.length },
  });

  // DM each approver with inline buttons
  for (const a of approvers) {
    const stepRow = await db()
      .select({ id: schema.approvalSteps.id })
      .from(schema.approvalSteps)
      .where(and(eq(schema.approvalSteps.approvalId, approval!.id), eq(schema.approvalSteps.approverUserId, a.id)))
      .limit(1);
    const stepId = stepRow[0]?.id;
    if (!stepId) continue;
    await sendMessage(
      a.telegramId,
      `🛂 <b>Approval requested</b>\nTask <b>#${taskId}</b> · ${h(task[0].title)}\nRequested by <b>${h(displayName(tg))}</b>`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `ap:y:${stepId}` },
              { text: "❌ Reject", callback_data: `ap:n:${stepId}` },
            ],
            [{ text: "👁️ View task", callback_data: `t:view:${taskId}` }],
          ],
        },
      }
    ).catch((e) => log.warn("approval dm failed", { err: String(e) }));
  }

  await ctx.reply(
    `✅ Approval requested on <b>#${taskId}</b>.\n` +
      `Mode: <b>${allMode ? "All approvers required" : "Any one approver"}</b>\n` +
      `Approvers notified: ${approvers.length}`,
    { parse_mode: "HTML" }
  );
}

export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const verb = parts[0]; // y / n
  const stepId = Number(parts[1]);
  if (!Number.isInteger(stepId)) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.answerCallbackQuery({ text: "Not a member." }).catch(() => {});
    return;
  }
  await ctx.answerCallbackQuery().catch(() => {});

  // Verify the step belongs to this user
  const step = await db()
    .select({
      id: schema.approvalSteps.id,
      approvalId: schema.approvalSteps.approvalId,
      approverUserId: schema.approvalSteps.approverUserId,
      decision: schema.approvalSteps.decision,
    })
    .from(schema.approvalSteps)
    .where(eq(schema.approvalSteps.id, stepId))
    .limit(1);
  if (!step[0] || step[0].approverUserId !== m.userId) {
    await ctx.reply("This approval is not yours.");
    return;
  }
  if (step[0].decision !== "pending") {
    await ctx.reply(`You already ${step[0].decision} this.`);
    return;
  }

  if (verb === "n") {
    await setState<RejectInputState>(ctx.chat!.id, tg.id, { flow: "reject_reason", approvalStepId: stepId });
    await ctx.reply(`✏️ Send a short reason for rejection (or /skip):`);
    return;
  }
  // verb === "y"
  await applyDecision(ctx, m.workspaceId, m.userId, stepId, "approved", null);
}

export async function consumeRejectReason(ctx: Context, state: RejectInputState) {
  const tg = ctx.from!;
  const text = ctx.message?.text?.trim() ?? "";
  await clearState(ctx.chat!.id, tg.id);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return;
  await applyDecision(ctx, m.workspaceId, m.userId, state.approvalStepId, "rejected", text || null);
}

async function applyDecision(
  ctx: Context,
  workspaceId: number,
  userId: number,
  stepId: number,
  decision: "approved" | "rejected",
  reason: string | null
) {
  await db()
    .update(schema.approvalSteps)
    .set({ decision, reason, decidedAt: new Date() })
    .where(eq(schema.approvalSteps.id, stepId));

  const stepRow = await db()
    .select({ approvalId: schema.approvalSteps.approvalId })
    .from(schema.approvalSteps)
    .where(eq(schema.approvalSteps.id, stepId))
    .limit(1);
  const approvalId = stepRow[0]?.approvalId;
  if (!approvalId) return;

  // Recompute counts
  const counts = await db()
    .select({ id: schema.approvalSteps.id, decision: schema.approvalSteps.decision })
    .from(schema.approvalSteps)
    .where(eq(schema.approvalSteps.approvalId, approvalId));
  const approved = counts.filter((c) => c.decision === "approved").length;
  const rejected = counts.filter((c) => c.decision === "rejected").length;
  const pending = counts.filter((c) => c.decision === "pending").length;

  const approval = await db()
    .select({
      id: schema.approvals.id,
      taskId: schema.approvals.taskId,
      type: schema.approvals.type,
      requiredCount: schema.approvals.requiredCount,
    })
    .from(schema.approvals)
    .where(eq(schema.approvals.id, approvalId))
    .limit(1);
  if (!approval[0]) return;

  let nextStatus: "pending" | "approved" | "rejected" = "pending";
  if (approval[0].type === "all") {
    if (rejected > 0) nextStatus = "rejected";
    else if (approved >= counts.length) nextStatus = "approved";
  } else {
    // any
    if (approved >= 1) nextStatus = "approved";
    else if (rejected >= 1 && pending === 0) nextStatus = "rejected";
  }

  await db()
    .update(schema.approvals)
    .set({ approvedCount: approved, rejectedCount: rejected, status: nextStatus })
    .where(eq(schema.approvals.id, approvalId));

  await audit({
    workspaceId,
    actorId: userId,
    action: "update",
    entity: "approval",
    entityId: approvalId,
    diff: { decision, reason, approved, rejected, status: nextStatus },
  });

  // Notify task creator + flip task status if terminal
  if (nextStatus !== "pending") {
    const newTaskStatus = nextStatus === "approved" ? "in_progress" : "rejected";
    await db().update(schema.tasks).set({ status: newTaskStatus, updatedAt: new Date() }).where(eq(schema.tasks.id, approval[0].taskId));
    const t = await db().select({ creatorId: schema.tasks.creatorId, title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.id, approval[0].taskId)).limit(1);
    if (t[0]) {
      const creator = await db()
        .select({ telegramId: schema.users.telegramId })
        .from(schema.users)
        .where(eq(schema.users.id, t[0].creatorId))
        .limit(1);
      if (creator[0]) {
        const emoji = nextStatus === "approved" ? "✅" : "❌";
        await sendMessage(
          creator[0].telegramId,
          `${emoji} Approval on <b>#${approval[0].taskId}</b> resolved: <b>${nextStatus}</b>`,
          { reply_markup: { inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${approval[0].taskId}` }]] } }
        ).catch(() => {});
      }
    }
  }

  await ctx.reply(`Recorded: <b>${decision}</b>${reason ? `\nReason: ${h(reason)}` : ""}`, {
    parse_mode: "HTML",
  });
}
