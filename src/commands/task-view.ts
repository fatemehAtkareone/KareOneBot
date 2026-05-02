import type { Context } from "grammy";
import { and, eq, desc } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { h, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { setState, clearState, redis } from "@/lib/redis";
import { taskActionsKb, priorityChooseKb, snoozeKb, reschedKb, reassignKb } from "@/lib/keyboards";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import { log } from "@/lib/logger";

const TZ = "Asia/Tehran";
const PRIORITY_LABEL: Record<string, string> = { p0: "🔴 P0", p1: "🟠 P1", p2: "🟡 P2", p3: "🟢 P3" };
const STATUS_KEYS: Record<string, string> = {
  open: "status_open", assigned: "status_assigned", in_progress: "status_in_progress",
  blocked: "status_blocked", in_review: "status_in_review", done: "status_done",
  cancelled: "status_cancelled", rejected: "status_rejected", archived: "status_archived", draft: "status_draft",
};

interface AddCommentState { flow: "comment"; taskId: number }
interface AddSubtaskState { flow: "subtask"; parentId: number }

export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const verb = parts[0]!;
  const taskId = Number(parts[1]);
  if (!Number.isInteger(taskId) && !["rapg"].includes(verb)) {
    await ctx.answerCallbackQuery({ text: t(lc, "not_found") }).catch(() => {});
    return;
  }

  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.answerCallbackQuery({ text: t(lc, "not_member") }).catch(() => {});
    return;
  }

  await ctx.answerCallbackQuery().catch(() => {});

  switch (verb) {
    case "view":
      return renderTask(ctx, taskId);
    case "done":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "done");
    case "start":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "in_progress");
    case "block":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "blocked");
    case "review":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "in_review");
    case "reopen":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "open");
    case "tcancel":
      return setStatus(ctx, taskId, m.userId, m.workspaceId, "cancelled");
    case "prio":
      return ctx.editMessageText(t(lc, "priority_prompt", { id: String(taskId) }), {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: priorityChooseKb(lc, taskId) },
      });
    case "setprio":
      return setPriority(ctx, taskId, m.userId, m.workspaceId, parts[2] as "p0" | "p1" | "p2" | "p3");
    case "snz":
      return ctx.editMessageText(t(lc, "snooze_prompt", { id: String(taskId) }), {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: snoozeKb(lc, taskId) },
      });
    case "setsnz":
      return setSnooze(ctx, taskId, m.userId, m.workspaceId, parts[2]!);
    case "resched":
      return ctx.editMessageText(t(lc, "resched_prompt", { id: String(taskId) }), {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: reschedKb(lc, taskId) },
      });
    case "setdue":
      return setDue(ctx, taskId, m.userId, m.workspaceId, parts[2]!);
    case "reassign":
      return openReassign(ctx, lc, taskId, m.workspaceId, 0);
    case "rapg":
      return openReassign(ctx, lc, taskId, m.workspaceId, Number(parts[2] ?? 0));
    case "setasgn":
      return setAssignee(ctx, taskId, m.userId, m.workspaceId, parts[2]!);
    case "watch":
      return setWatch(ctx, taskId, m.userId, true);
    case "unwatch":
      return setWatch(ctx, taskId, m.userId, false);
    case "cmt":
      return promptComment(ctx, taskId);
    case "sub":
      return promptSubtask(ctx, taskId);
    case "wstart":
      return startWorkTimer(ctx, taskId, m.userId);
    case "wstop":
      return stopWorkTimer(ctx, taskId, m.userId, m.workspaceId);
    case "lbl":
      return ctx.answerCallbackQuery({ text: "🏷️" }).catch(() => {});
    default:
      return;
  }
}

export async function handleViewTask(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) {
    await ctx.reply(t(lc, "invalid_format", { usage: "/task <id>" }));
    return;
  }
  await renderTask(ctx, id);
}

async function renderTask(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await replyOrEdit(ctx, t(lc, "not_member"));
    return;
  }
  const task = await loadTask(taskId, m.workspaceId);
  if (!task) {
    await replyOrEdit(ctx, t(lc, "task_not_found", { id: String(taskId) }));
    return;
  }
  const watching = await isWatching(taskId, m.userId);
  const assignees = await loadAssignees(taskId);
  const subtasks = await loadSubtasks(taskId, m.workspaceId);
  const comments = await loadRecentComments(taskId);
  const timer = await currentTimerForUser(taskId, m.userId);

  const dueText = task.dueAt
    ? DateTime.fromJSDate(task.dueAt).setZone(TZ).toFormat("yyyy-LL-dd HH:mm")
    : "—";
  const overdue = task.dueAt && task.dueAt < new Date() && task.status !== "done";

  const lines: string[] = [];
  lines.push(`<b>#${task.id} · ${h(task.title)}</b>`);
  if (task.description) lines.push(`\n${h(task.description)}`);
  lines.push("");
  lines.push(`${t(lc, STATUS_KEYS[task.status]!)}  ·  ${PRIORITY_LABEL[task.priority] ?? task.priority}`);
  lines.push(t(lc, "card_due_label", { due: (overdue ? "🚨 " : "") + h(dueText) }));
  lines.push(`👤 ${assignees.length === 0 ? t(lc, "card_unassigned") : assignees.map(h).join(", ")}`);
  if (task.recurrenceRule) lines.push(t(lc, "card_recurrence", { rule: h(task.recurrenceRule) }));
  if (subtasks.length) {
    lines.push("\n" + t(lc, "card_subtasks_header", { n: String(subtasks.length) }));
    for (const s of subtasks.slice(0, 8)) {
      const tick = s.status === "done" ? "✅" : "⬜";
      lines.push(`${tick} #${s.id} ${h(s.title)}`);
    }
  }
  if (comments.length) {
    lines.push("\n" + t(lc, "card_recent_comments"));
    for (const c of comments) {
      const when = DateTime.fromJSDate(c.createdAt).setZone(TZ).toFormat("LL-dd HH:mm");
      lines.push(`💬 <i>${h(c.author)}</i> · ${when}\n${h(c.body.slice(0, 200))}`);
    }
  }
  if (timer) {
    const mins = Math.floor((Date.now() - timer) / 60000);
    lines.push("\n" + t(lc, "card_timer_running", { min: String(mins) }));
  }

  await replyOrEdit(ctx, lines.join("\n"), {
    reply_markup: { inline_keyboard: taskActionsKb(lc, task.id, task.status, watching) },
  });
}

async function setStatus(
  ctx: Context, taskId: number, userId: number, workspaceId: number,
  status: "open" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled"
) {
  const updated = await db()
    .update(schema.tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)))
    .returning({ id: schema.tasks.id });
  if (!updated[0]) return;
  await audit({ workspaceId, actorId: userId, action: "status_change", entity: "task", entityId: taskId, diff: { status } });
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  await notifyWatchers(taskId, userId, t(lc, "notify_status_change", { id: String(taskId), status }));
  await renderTask(ctx, taskId);
}

async function setPriority(ctx: Context, taskId: number, userId: number, workspaceId: number, priority: "p0" | "p1" | "p2" | "p3") {
  await db().update(schema.tasks).set({ priority, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { priority } });
  await renderTask(ctx, taskId);
}

async function setSnooze(ctx: Context, taskId: number, userId: number, workspaceId: number, preset: string) {
  const now = DateTime.now().setZone(TZ);
  let next: DateTime;
  switch (preset) {
    case "1h": next = now.plus({ hours: 1 }); break;
    case "3h": next = now.plus({ hours: 3 }); break;
    case "tom9": next = now.plus({ days: 1 }).set({ hour: 9, minute: 0 }); break;
    case "mon9": next = now.plus({ weeks: 1 }).set({ weekday: 1, hour: 9, minute: 0 }); break;
    default: return;
  }
  await db().update(schema.tasks).set({ dueAt: next.toJSDate(), updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { snoozedTo: next.toISO() } });
  const r = redis();
  if (r) {
    await r.del(`notify:duesoon:${taskId}:${userId}`);
    await r.del(`notify:overdue:${taskId}:${userId}`);
  }
  await renderTask(ctx, taskId);
}

async function setDue(ctx: Context, taskId: number, userId: number, workspaceId: number, preset: string) {
  const now = DateTime.now().setZone(TZ);
  let dueAt: Date | null = null;
  if (preset === "none") dueAt = null;
  else {
    let date: DateTime;
    switch (preset) {
      case "today": date = now; break;
      case "tomorrow": date = now.plus({ days: 1 }); break;
      case "3d": date = now.plus({ days: 3 }); break;
      case "fri": date = now.set({ weekday: 5 }); break;
      case "nextmon": date = now.plus({ weeks: 1 }).set({ weekday: 1 }); break;
      default: return;
    }
    dueAt = date.set({ hour: 17, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  }
  await db().update(schema.tasks).set({ dueAt, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { dueAt: dueAt?.toISOString() ?? null } });
  const r = redis();
  if (r) {
    await r.del(`notify:duesoon:${taskId}:${userId}`);
    await r.del(`notify:overdue:${taskId}:${userId}`);
  }
  await renderTask(ctx, taskId);
}

async function openReassign(ctx: Context, lc: string, taskId: number, workspaceId: number, page: number) {
  const members = await db()
    .select({ id: schema.users.id, first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.active, true)))
    .limit(50);
  const list = members.map((r) => ({
    id: r.id,
    name: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : `user#${r.id}`),
  }));
  await ctx.editMessageText(t(lc, "reassign_prompt", { id: String(taskId) }), {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: reassignKb(lc, taskId, list, page) },
  });
}

async function setAssignee(ctx: Context, taskId: number, userId: number, workspaceId: number, target: string) {
  let newId: number;
  if (target === "self") newId = userId;
  else newId = Number(target);
  if (!Number.isInteger(newId)) return;

  await db().delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, taskId));
  await db().insert(schema.taskAssignees).values({ taskId, userId: newId });
  await db().update(schema.tasks).set({ status: "assigned", updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "assign", entity: "task", entityId: taskId, diff: { assigneeUserId: newId } });

  if (newId !== userId) {
    const u = await db().select({ telegramId: schema.users.telegramId }).from(schema.users).where(eq(schema.users.id, newId)).limit(1);
    if (u[0]) {
      const tg = ctx.from!;
      const lc = await userLang(tg.id, tg.language_code);
      const tk = await loadTask(taskId, workspaceId);
      await sendMessage(
        u[0].telegramId,
        t(lc, "task_assigned_dm", { id: String(taskId), title: h(tk?.title ?? "") }),
        { reply_markup: { inline_keyboard: [[{ text: t(lc, "btn_view_task"), callback_data: `t:view:${taskId}` }]] } }
      ).catch((e) => log.warn("notify reassign failed", { err: String(e) }));
    }
  }
  await renderTask(ctx, taskId);
}

async function setWatch(ctx: Context, taskId: number, userId: number, on: boolean) {
  if (on) {
    await db().insert(schema.taskWatchers).values({ taskId, userId }).onConflictDoNothing();
  } else {
    await db().delete(schema.taskWatchers)
      .where(and(eq(schema.taskWatchers.taskId, taskId), eq(schema.taskWatchers.userId, userId)));
  }
  await renderTask(ctx, taskId);
}

async function promptComment(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  await setState<AddCommentState>(chatId, tg.id, { flow: "comment", taskId });
  await ctx.editMessageText(t(lc, "comment_prompt", { id: String(taskId) }), { parse_mode: "HTML" });
}

export async function consumeCommentInput(ctx: Context, state: AddCommentState) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim();
  if (!text) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await clearState(chatId, tg.id);
    return;
  }
  await db().insert(schema.comments).values({ taskId: state.taskId, authorId: m.userId, body: text.slice(0, 4000) });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "comment", entity: "task", entityId: state.taskId });
  await notifyWatchers(state.taskId, m.userId, t(lc, "notify_new_comment", { id: String(state.taskId) }));
  await clearState(chatId, tg.id);
  await ctx.reply(t(lc, "comment_added"));
  await renderTask(ctx, state.taskId);
}

async function promptSubtask(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  await setState<AddSubtaskState>(chatId, tg.id, { flow: "subtask", parentId: taskId });
  await ctx.editMessageText(t(lc, "subtask_prompt", { id: String(taskId) }), { parse_mode: "HTML" });
}

export async function consumeSubtaskInput(ctx: Context, state: AddSubtaskState) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim();
  if (!text) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await clearState(chatId, tg.id);
    return;
  }
  const parent = await loadTask(state.parentId, m.workspaceId);
  if (!parent) {
    await clearState(chatId, tg.id);
    await ctx.reply(t(lc, "parent_not_found"));
    return;
  }
  const [child] = await db().insert(schema.tasks).values({
    workspaceId: m.workspaceId, creatorId: m.userId, parentId: state.parentId,
    title: text.slice(0, 200), priority: parent.priority, status: "open",
  }).returning({ id: schema.tasks.id });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "task", entityId: child!.id, diff: { parentId: state.parentId } });
  await clearState(chatId, tg.id);
  await ctx.reply(t(lc, "subtask_created", { id: String(child!.id) }), { parse_mode: "HTML" });
  await renderTask(ctx, state.parentId);
}

async function startWorkTimer(ctx: Context, taskId: number, userId: number) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const r = redis();
  if (!r) {
    await ctx.answerCallbackQuery({ text: t(lc, "timers_require_redis") }).catch(() => {});
    return;
  }
  await r.set(`timer:${userId}:${taskId}`, Date.now(), { ex: 60 * 60 * 12 });
  await db().update(schema.tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
  await renderTask(ctx, taskId);
}

async function stopWorkTimer(ctx: Context, taskId: number, userId: number, workspaceId: number) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const r = redis();
  if (!r) return;
  const startedAt = await r.get<number>(`timer:${userId}:${taskId}`);
  if (!startedAt) {
    await ctx.answerCallbackQuery({ text: t(lc, "no_timer") }).catch(() => {});
    return;
  }
  const minutes = Math.max(1, Math.floor((Date.now() - Number(startedAt)) / 60000));
  await r.del(`timer:${userId}:${taskId}`);
  await db().insert(schema.comments).values({ taskId, authorId: userId, body: `⏱️ +${minutes} min` });
  const current = await db().select({ actual: schema.tasks.actualMinutes }).from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  const next = (current[0]?.actual ?? 0) + minutes;
  await db().update(schema.tasks).set({ actualMinutes: next, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { loggedMinutes: minutes } });
  await renderTask(ctx, taskId);
}

async function loadTask(taskId: number, workspaceId: number) {
  const r = await db().select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId))).limit(1);
  return r[0] ?? null;
}
async function loadAssignees(taskId: number): Promise<string[]> {
  const rows = await db()
    .select({ first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
    .from(schema.taskAssignees)
    .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
    .where(eq(schema.taskAssignees.taskId, taskId));
  return rows.map((r) => [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "user"));
}
async function loadSubtasks(parentId: number, workspaceId: number) {
  return db().select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.parentId, parentId), eq(schema.tasks.workspaceId, workspaceId)))
    .limit(20);
}
async function loadRecentComments(taskId: number) {
  const rows = await db()
    .select({
      body: schema.comments.body, createdAt: schema.comments.createdAt,
      first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(eq(schema.comments.taskId, taskId))
    .orderBy(desc(schema.comments.createdAt))
    .limit(3);
  return rows.reverse().map((r) => ({
    body: r.body, createdAt: r.createdAt,
    author: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "user"),
  }));
}
async function isWatching(taskId: number, userId: number): Promise<boolean> {
  const r = await db().select({ taskId: schema.taskWatchers.taskId }).from(schema.taskWatchers)
    .where(and(eq(schema.taskWatchers.taskId, taskId), eq(schema.taskWatchers.userId, userId))).limit(1);
  return !!r[0];
}
async function currentTimerForUser(taskId: number, userId: number): Promise<number | null> {
  const r = redis();
  if (!r) return null;
  const v = await r.get<number>(`timer:${userId}:${taskId}`);
  return v ? Number(v) : null;
}
async function notifyWatchers(taskId: number, exceptUserId: number, text: string) {
  try {
    const rows = await db()
      .select({ telegramId: schema.users.telegramId, userId: schema.taskWatchers.userId })
      .from(schema.taskWatchers)
      .innerJoin(schema.users, eq(schema.users.id, schema.taskWatchers.userId))
      .where(eq(schema.taskWatchers.taskId, taskId));
    for (const w of rows) {
      if (w.userId === exceptUserId) continue;
      await sendMessage(w.telegramId, text, {
        reply_markup: { inline_keyboard: [[{ text: "👁️", callback_data: `t:view:${taskId}` }]] },
      }).catch(() => {});
    }
  } catch (e) {
    log.warn("notifyWatchers failed", { err: String(e) });
  }
}
async function replyOrEdit(ctx: Context, text: string, extra?: Record<string, unknown>) {
  const opts = { parse_mode: "HTML" as const, ...extra };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch { /* noop */ }
  }
  await ctx.reply(text, opts);
}
