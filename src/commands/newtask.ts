import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { setState, clearState, getState } from "@/lib/redis";
import { parseDue } from "@/lib/dueparse";
import { md, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

export interface NewTaskState {
  flow: "newtask";
  step: 0 | 1 | 2 | 3; // 0:title 1:assignee 2:due 3:priority
  data: {
    title?: string;
    assigneeUsername?: string;
    dueAt?: string;   // ISO
    priority?: "p0" | "p1" | "p2" | "p3";
  };
}

export async function handleNewTask(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.reply(t(tg.language_code, "not_member"));
    return;
  }
  const chatId = ctx.chat!.id;

  // One-shot mode: /newtask <title...> due:<...> @user p0|p1|...
  if (args.length > 0) {
    const joined = args.join(" ");
    const dueMatch = joined.match(/\bdue:(\S+(?:\s+\d{1,2}(?::\d{2})?(?:am|pm)?)?)/i);
    const userMatch = joined.match(/@([A-Za-z0-9_]{3,32})/);
    const prMatch = joined.match(/\b(p[0-3])\b/i);
    const title = joined
      .replace(dueMatch?.[0] ?? "", "")
      .replace(userMatch?.[0] ?? "", "")
      .replace(prMatch?.[0] ?? "", "")
      .trim();

    if (title) {
      await createTask(ctx, m.workspaceId, m.userId, {
        title,
        assigneeUsername: userMatch?.[1],
        dueAt: dueMatch ? parseDue(dueMatch[1]!, "Asia/Tehran")?.toISOString() : undefined,
        priority: (prMatch?.[1]?.toLowerCase() as NewTaskState["data"]["priority"]) ?? "p2",
      });
      return;
    }
  }

  // Wizard mode
  await setState<NewTaskState>(chatId, tg.id, { flow: "newtask", step: 0, data: {} });
  await ctx.reply(t(tg.language_code, "wizard_title"));
}

export async function handleNewTaskWizardStep(ctx: Context, state: NewTaskState) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim() ?? "";

  switch (state.step) {
    case 0: {
      state.data.title = text;
      state.step = 1;
      await setState(chatId, tg.id, state);
      await ctx.reply(t(tg.language_code, "wizard_assignee"));
      return;
    }
    case 1: {
      const m = text.match(/^@([A-Za-z0-9_]{3,32})/);
      if (m) state.data.assigneeUsername = m[1];
      state.step = 2;
      await setState(chatId, tg.id, state);
      await ctx.reply(t(tg.language_code, "wizard_due"));
      return;
    }
    case 2: {
      const due = parseDue(text, "Asia/Tehran");
      if (due) state.data.dueAt = due.toISOString();
      state.step = 3;
      await setState(chatId, tg.id, state);
      await ctx.reply(t(tg.language_code, "wizard_priority"));
      return;
    }
    case 3: {
      const p = text.toLowerCase();
      if (["p0", "p1", "p2", "p3"].includes(p)) state.data.priority = p as NewTaskState["data"]["priority"];

      const membership = await getMembershipByTelegramId(tg.id);
      if (!membership) {
        await clearState(chatId, tg.id);
        await ctx.reply(t(tg.language_code, "not_member"));
        return;
      }
      await createTask(ctx, membership.workspaceId, membership.userId, state.data);
      await clearState(chatId, tg.id);
      return;
    }
  }
}

async function createTask(
  ctx: Context,
  workspaceId: number,
  creatorId: number,
  data: NewTaskState["data"]
) {
  const tg = ctx.from!;
  const lc = tg.language_code;

  let assigneeUserId: number | null = null;
  if (data.assigneeUsername) {
    const found = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
      .where(
        and(
          eq(schema.users.telegramUsername, data.assigneeUsername),
          eq(schema.memberships.workspaceId, workspaceId)
        )
      )
      .limit(1);
    if (found[0]) assigneeUserId = found[0].id;
  }

  const [task] = await db()
    .insert(schema.tasks)
    .values({
      workspaceId,
      creatorId,
      title: data.title!,
      priority: data.priority ?? "p2",
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      status: assigneeUserId ? "assigned" : "open",
    })
    .returning({ id: schema.tasks.id });

  if (assigneeUserId) {
    await db().insert(schema.taskAssignees).values({ taskId: task!.id, userId: assigneeUserId });
    // Notify the assignee
    const assigneeTg = await db()
      .select({ telegramId: schema.users.telegramId })
      .from(schema.users)
      .where(eq(schema.users.id, assigneeUserId))
      .limit(1);
    if (assigneeTg[0]) {
      await sendMessage(
        assigneeTg[0].telegramId,
        `🆕 ${md(`New task #${task!.id}: ${data.title}`)}`
      ).catch((e) => log.warn("notify assignee failed", { err: String(e) }));
    }
  }

  await audit({ workspaceId, actorId: creatorId, action: "create", entity: "task", entityId: task!.id, diff: { ...data } });
  await ctx.reply(t(lc, "task_created", { id: String(task!.id), title: md(data.title ?? "") }), {
    parse_mode: "MarkdownV2",
  });
}
