import type { Context } from "grammy";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { h, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { displayName } from "@/lib/users";
import { setState, clearState } from "@/lib/redis";
import { log } from "@/lib/logger";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

interface RejectInputState { flow: "reject_reason"; approvalStepId: number }

export async function handleApprovalRequest(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const idArg = args[0];
  const taskId = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  const userArgs = args.slice(1).filter((a) => a.startsWith("@"));
  const allMode = args.slice(1).includes("all");

  if (!Number.isInteger(taskId) || userArgs.length === 0) {
    await ctx.reply(t(lc, "ap_use"), { parse_mode: "HTML" });
    return;
  }

  const task = await db().select({ id: schema.tasks.id, title: schema.tasks.title })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId)))
    .limit(1);
  if (!task[0]) return void ctx.reply(t(lc, "task_not_found", { id: String(taskId) }));

  const usernames = userArgs.map((u) => u.slice(1));
  const approvers = await db()
    .select({ id: schema.users.id, telegramId: schema.users.telegramId, uname: schema.users.telegramUsername })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(and(
      eq(schema.memberships.workspaceId, m.workspaceId),
      inArray(schema.users.telegramUsername, usernames)
    ));

  if (approvers.length === 0) {
    await ctx.reply(t(lc, "ap_no_approvers"));
    return;
  }

  const requiredCount = allMode ? approvers.length : 1;

  const [approval] = await db().insert(schema.approvals).values({
    taskId, type: allMode ? "all" : "any", requiredCount, requestedBy: m.userId,
  }).returning({ id: schema.approvals.id });

  await db().insert(schema.approvalSteps).values(
    approvers.map((a) => ({ approvalId: approval!.id, approverUserId: a.id }))
  );

  await db().update(schema.tasks).set({ status: "in_review", updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));

  await audit({
    workspaceId: m.workspaceId, actorId: m.userId, action: "create",
    entity: "approval", entityId: approval!.id,
    diff: { taskId, type: allMode ? "all" : "any", required: requiredCount, approvers: approvers.length },
  });

  for (const a of approvers) {
    const stepRow = await db().select({ id: schema.approvalSteps.id }).from(schema.approvalSteps)
      .where(and(eq(schema.approvalSteps.approvalId, approval!.id), eq(schema.approvalSteps.approverUserId, a.id)))
      .limit(1);
    const stepId = stepRow[0]?.id;
    if (!stepId) continue;
    const approverLc = await userLang(a.telegramId, undefined);
    await sendMessage(
      a.telegramId,
      t(approverLc, "ap_dm", { id: String(taskId), title: h(task[0].title), who: h(displayName(tg)) }),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: t(approverLc, "btn_approve"), callback_data: `ap:y:${stepId}` },
              { text: t(approverLc, "btn_reject"), callback_data: `ap:n:${stepId}` },
            ],
            [{ text: t(approverLc, "btn_view_task"), callback_data: `t:view:${taskId}` }],
          ],
        },
      }
    ).catch((e) => log.warn("approval dm failed", { err: String(e) }));
  }

  await ctx.reply(
    t(lc, "ap_started", {
      id: String(taskId),
      mode: allMode ? t(lc, "ap_mode_all") : t(lc, "ap_mode_any"),
      n: String(approvers.length),
    }),
    { parse_mode: "HTML" }
  );
}

export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const verb = parts[0];
  const stepId = Number(parts[1]);
  if (!Number.isInteger(stepId)) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.answerCallbackQuery({ text: t(lc, "not_member") }).catch(() => {});
    return;
  }
  await ctx.answerCallbackQuery().catch(() => {});

  const step = await db().select({
    id: schema.approvalSteps.id, approvalId: schema.approvalSteps.approvalId,
    approverUserId: schema.approvalSteps.approverUserId, decision: schema.approvalSteps.decision,
  }).from(schema.approvalSteps).where(eq(schema.approvalSteps.id, stepId)).limit(1);
  if (!step[0] || step[0].approverUserId !== m.userId) {
    await ctx.reply(t(lc, "ap_not_yours"));
    return;
  }
  if (step[0].decision !== "pending") {
    await ctx.reply(t(lc, "ap_already_decided", { decision: step[0].decision }));
    return;
  }

  if (verb === "n") {
    await setState<RejectInputState>(ctx.chat!.id, tg.id, { flow: "reject_reason", approvalStepId: stepId });
    await ctx.reply(t(lc, "ap_send_reason"));
    return;
  }
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
  ctx: Context, workspaceId: number, userId: number,
  stepId: number, decision: "approved" | "rejected", reason: string | null
) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);

  await db().update(schema.approvalSteps)
    .set({ decision, reason, decidedAt: new Date() })
    .where(eq(schema.approvalSteps.id, stepId));

  const stepRow = await db().select({ approvalId: schema.approvalSteps.approvalId })
    .from(schema.approvalSteps).where(eq(schema.approvalSteps.id, stepId)).limit(1);
  const approvalId = stepRow[0]?.approvalId;
  if (!approvalId) return;

  const counts = await db().select({ id: schema.approvalSteps.id, decision: schema.approvalSteps.decision })
    .from(schema.approvalSteps).where(eq(schema.approvalSteps.approvalId, approvalId));
  const approved = counts.filter((c) => c.decision === "approved").length;
  const rejected = counts.filter((c) => c.decision === "rejected").length;
  const pending = counts.filter((c) => c.decision === "pending").length;

  const approval = await db().select({
    id: schema.approvals.id, taskId: schema.approvals.taskId, type: schema.approvals.type,
  }).from(schema.approvals).where(eq(schema.approvals.id, approvalId)).limit(1);
  if (!approval[0]) return;

  let nextStatus: "pending" | "approved" | "rejected" = "pending";
  if (approval[0].type === "all") {
    if (rejected > 0) nextStatus = "rejected";
    else if (approved >= counts.length) nextStatus = "approved";
  } else {
    if (approved >= 1) nextStatus = "approved";
    else if (rejected >= 1 && pending === 0) nextStatus = "rejected";
  }

  await db().update(schema.approvals)
    .set({ approvedCount: approved, rejectedCount: rejected, status: nextStatus })
    .where(eq(schema.approvals.id, approvalId));

  await audit({
    workspaceId, actorId: userId, action: "update", entity: "approval", entityId: approvalId,
    diff: { decision, reason, approved, rejected, status: nextStatus },
  });

  if (nextStatus !== "pending") {
    const newTaskStatus = nextStatus === "approved" ? "in_progress" : "rejected";
    await db().update(schema.tasks).set({ status: newTaskStatus, updatedAt: new Date() })
      .where(eq(schema.tasks.id, approval[0].taskId));
    const tk = await db().select({ creatorId: schema.tasks.creatorId, title: schema.tasks.title })
      .from(schema.tasks).where(eq(schema.tasks.id, approval[0].taskId)).limit(1);
    if (tk[0]) {
      const creator = await db().select({ telegramId: schema.users.telegramId })
        .from(schema.users).where(eq(schema.users.id, tk[0].creatorId)).limit(1);
      if (creator[0]) {
        const creatorLc = await userLang(creator[0].telegramId, undefined);
        const emoji = nextStatus === "approved" ? "✅" : "❌";
        await sendMessage(
          creator[0].telegramId,
          t(creatorLc, "ap_resolved_dm", { emoji, id: String(approval[0].taskId), status: nextStatus }),
          { reply_markup: { inline_keyboard: [[{ text: t(creatorLc, "btn_view_task"), callback_data: `t:view:${approval[0].taskId}` }]] } }
        ).catch(() => {});
      }
    }
  }

  await ctx.reply(
    reason
      ? t(lc, "ap_recorded_with_reason", { decision, reason: h(reason) })
      : t(lc, "ap_recorded", { decision }),
    { parse_mode: "HTML" }
  );
}
