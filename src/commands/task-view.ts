import type { Context } from "grammy";
import { and, eq, desc } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId, hasRole } from "@/lib/rbac";
import { h, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { setState, getState, clearState, redis } from "@/lib/redis";
import { taskActionsKb, priorityChooseKb, snoozeKb, reschedKb, reassignKb } from "@/lib/keyboards";
import { log } from "@/lib/logger";

const TZ = "Asia/Tehran";

const PRIORITY_LABEL: Record<string, string> = {
  p0: "🔴 P0",
  p1: "🟠 P1",
  p2: "🟡 P2",
  p3: "🟢 P3",
};

const STATUS_EMOJI: Record<string, string> = {
  open: "📂 Open",
  assigned: "📌 Assigned",
  in_progress: "🔧 In progress",
  blocked: "🛑 Blocked",
  in_review: "👀 In review",
  done: "✅ Done",
  cancelled: "❌ Cancelled",
  rejected: "🚫 Rejected",
  archived: "🗄️ Archived",
  draft: "📝 Draft",
};

interface AddCommentState {
  flow: "comment";
  taskId: number;
}
interface AddSubtaskState {
  flow: "subtask";
  parentId: number;
}

export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const verb = parts[0]!;
  const taskId = Number(parts[1]);
  if (!Number.isInteger(taskId) && !["rapg"].includes(verb)) {
    await ctx.answerCallbackQuery({ text: "Bad task id." }).catch(() => {});
    return;
  }

  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.answerCallbackQuery({ text: "Not a member." }).catch(() => {});
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
      return ctx.editMessageText(`⚡ Choose priority for task #${taskId}:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: priorityChooseKb(taskId) },
      });
    case "setprio":
      return setPriority(ctx, taskId, m.userId, m.workspaceId, parts[2] as "p0" | "p1" | "p2" | "p3");
    case "snz":
      return ctx.editMessageText(`⏰ Snooze task #${taskId} until:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: snoozeKb(taskId) },
      });
    case "setsnz":
      return setSnooze(ctx, taskId, m.userId, m.workspaceId, parts[2]!);
    case "resched":
      return ctx.editMessageText(`📅 Reschedule task #${taskId}:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: reschedKb(taskId) },
      });
    case "setdue":
      return setDue(ctx, taskId, m.userId, m.workspaceId, parts[2]!);
    case "reassign":
      return openReassign(ctx, taskId, m.workspaceId, 0);
    case "rapg":
      return openReassign(ctx, taskId, m.workspaceId, Number(parts[2] ?? 0));
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
      return ctx.answerCallbackQuery({ text: "Labels — coming in admin menu" }).catch(() => {});
    default:
      return;
  }
}

/** /task <id> command alias for direct viewing. */
export async function handleViewTask(ctx: Context, args: string[]) {
  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) {
    await ctx.reply("Usage: /task <id>");
    return;
  }
  await renderTask(ctx, id);
}

// ----- core renderer -----

async function renderTask(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await replyOrEdit(ctx, "Not a member of this workspace.");
    return;
  }
  const t = await loadTask(taskId, m.workspaceId);
  if (!t) {
    await replyOrEdit(ctx, `Task #${taskId} not found.`);
    return;
  }
  const watching = await isWatching(taskId, m.userId);
  const assignees = await loadAssignees(taskId);
  const subtasks = await loadSubtasks(taskId, m.workspaceId);
  const comments = await loadRecentComments(taskId);
  const timer = await currentTimerForUser(taskId, m.userId);

  const dueText = t.dueAt
    ? DateTime.fromJSDate(t.dueAt).setZone(TZ).toFormat("yyyy-LL-dd HH:mm")
    : "—";
  const overdue = t.dueAt && t.dueAt < new Date() && t.status !== "done";

  const lines: string[] = [];
  lines.push(`<b>#${t.id} · ${h(t.title)}</b>`);
  if (t.description) lines.push(`\n${h(t.description)}`);
  lines.push("");
  lines.push(`${STATUS_EMOJI[t.status] ?? t.status}  ·  ${PRIORITY_LABEL[t.priority] ?? t.priority}`);
  lines.push(`📅 Due: ${overdue ? "🚨 " : ""}${h(dueText)}`);
  lines.push(`👤 ${assignees.length === 0 ? "Unassigned" : assignees.map((a) => h(a)).join(", ")}`);
  if (t.recurrenceRule) lines.push(`🔁 Recurrence: <code>${h(t.recurrenceRule)}</code>`);
  if (subtasks.length) {
    lines.push(`\n<b>Subtasks (${subtasks.length}):</b>`);
    for (const s of subtasks.slice(0, 8)) {
      const tick = s.status === "done" ? "✅" : "⬜";
      lines.push(`${tick} #${s.id} ${h(s.title)}`);
    }
  }
  if (comments.length) {
    lines.push(`\n<b>Recent comments:</b>`);
    for (const c of comments) {
      const when = DateTime.fromJSDate(c.createdAt).setZone(TZ).toFormat("LL-dd HH:mm");
      lines.push(`💬 <i>${h(c.author)}</i> · ${when}\n${h(c.body.slice(0, 200))}`);
    }
  }
  if (timer) {
    const mins = Math.floor((Date.now() - timer) / 60000);
    lines.push(`\n⏱️ Timer running · ${mins} min`);
  }

  await replyOrEdit(ctx, lines.join("\n"), {
    reply_markup: { inline_keyboard: taskActionsKb(t.id, t.status, watching) },
  });
}

// ----- mutations -----

async function setStatus(
  ctx: Context,
  taskId: number,
  userId: number,
  workspaceId: number,
  status: "open" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled"
) {
  const updated = await db()
    .update(schema.tasks)
    .set({
      status,
      completedAt: status === "done" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)))
    .returning({ id: schema.tasks.id });
  if (!updated[0]) return;
  await audit({
    workspaceId,
    actorId: userId,
    action: "status_change",
    entity: "task",
    entityId: taskId,
    diff: { status },
  });
  await notifyWatchers(taskId, userId, `🔄 <b>#${taskId}</b> status → <i>${status}</i>`);
  await renderTask(ctx, taskId);
}

async function setPriority(
  ctx: Context,
  taskId: number,
  userId: number,
  workspaceId: number,
  priority: "p0" | "p1" | "p2" | "p3"
) {
  await db()
    .update(schema.tasks)
    .set({ priority, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { priority } });
  await renderTask(ctx, taskId);
}

async function setSnooze(
  ctx: Context,
  taskId: number,
  userId: number,
  workspaceId: number,
  preset: string
) {
  const now = DateTime.now().setZone(TZ);
  let next: DateTime;
  switch (preset) {
    case "1h": next = now.plus({ hours: 1 }); break;
    case "3h": next = now.plus({ hours: 3 }); break;
    case "tom9": next = now.plus({ days: 1 }).set({ hour: 9, minute: 0 }); break;
    case "mon9": next = now.plus({ weeks: 1 }).set({ weekday: 1, hour: 9, minute: 0 }); break;
    default: return;
  }
  await db()
    .update(schema.tasks)
    .set({ dueAt: next.toJSDate(), updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { snoozedTo: next.toISO() } });

  // Reset notification dedup keys so reminders fire again
  const r = redis();
  if (r) {
    await r.del(`notify:duesoon:${taskId}:${userId}`);
    await r.del(`notify:overdue:${taskId}:${userId}`);
  }
  await renderTask(ctx, taskId);
}

async function setDue(
  ctx: Context,
  taskId: number,
  userId: number,
  workspaceId: number,
  preset: string
) {
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
  await db()
    .update(schema.tasks)
    .set({ dueAt, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { dueAt: dueAt?.toISOString() ?? null } });
  const r = redis();
  if (r) {
    await r.del(`notify:duesoon:${taskId}:${userId}`);
    await r.del(`notify:overdue:${taskId}:${userId}`);
  }
  await renderTask(ctx, taskId);
}

async function openReassign(ctx: Context, taskId: number, workspaceId: number, page: number) {
  const members = await db()
    .select({
      id: schema.users.id,
      first: schema.users.firstName,
      last: schema.users.lastName,
      uname: schema.users.telegramUsername,
    })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.active, true)))
    .limit(50);
  const list = members.map((r) => ({
    id: r.id,
    name: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : `user#${r.id}`),
  }));
  await ctx.editMessageText(`👤 Reassign task #${taskId} to:`, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: reassignKb(taskId, list, page) },
  });
}

async function setAssignee(
  ctx: Context,
  taskId: number,
  userId: number,
  workspaceId: number,
  target: string
) {
  let newId: number;
  if (target === "self") newId = userId;
  else newId = Number(target);
  if (!Number.isInteger(newId)) return;

  await db().delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, taskId));
  await db().insert(schema.taskAssignees).values({ taskId, userId: newId });
  await db()
    .update(schema.tasks)
    .set({ status: "assigned", updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)));
  await audit({ workspaceId, actorId: userId, action: "assign", entity: "task", entityId: taskId, diff: { assigneeUserId: newId } });

  if (newId !== userId) {
    const u = await db().select({ telegramId: schema.users.telegramId }).from(schema.users).where(eq(schema.users.id, newId)).limit(1);
    if (u[0]) {
      const t = await loadTask(taskId, workspaceId);
      await sendMessage(
        u[0].telegramId,
        `🆕 Task <b>#${taskId}</b> assigned to you.\n${h(t?.title ?? "")}`,
        { reply_markup: { inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${taskId}` }]] } }
      ).catch((e) => log.warn("notify reassign failed", { err: String(e) }));
    }
  }
  await renderTask(ctx, taskId);
}

async function setWatch(ctx: Context, taskId: number, userId: number, on: boolean) {
  if (on) {
    await db().insert(schema.taskWatchers).values({ taskId, userId }).onConflictDoNothing();
  } else {
    await db()
      .delete(schema.taskWatchers)
      .where(and(eq(schema.taskWatchers.taskId, taskId), eq(schema.taskWatchers.userId, userId)));
  }
  await renderTask(ctx, taskId);
}

async function promptComment(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  await setState<AddCommentState>(chatId, tg.id, { flow: "comment", taskId });
  await ctx.editMessageText(`💬 Send your comment for task #${taskId} (or /cancel):`, { parse_mode: "HTML" });
}

export async function consumeCommentInput(ctx: Context, state: AddCommentState) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim();
  if (!text) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await clearState(chatId, tg.id);
    return;
  }
  await db().insert(schema.comments).values({
    taskId: state.taskId,
    authorId: m.userId,
    body: text.slice(0, 4000),
  });
  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "comment",
    entity: "task",
    entityId: state.taskId,
  });
  await notifyWatchers(state.taskId, m.userId, `💬 New comment on <b>#${state.taskId}</b>`);
  await clearState(chatId, tg.id);
  await ctx.reply(`✅ Comment added.`);
  await renderTask(ctx, state.taskId);
}

async function promptSubtask(ctx: Context, taskId: number) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  await setState<AddSubtaskState>(chatId, tg.id, { flow: "subtask", parentId: taskId });
  await ctx.editMessageText(`➕ Send the subtask title for #${taskId} (or /cancel):`, { parse_mode: "HTML" });
}

export async function consumeSubtaskInput(ctx: Context, state: AddSubtaskState) {
  const tg = ctx.from!;
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
    await ctx.reply("Parent task not found.");
    return;
  }
  const [child] = await db()
    .insert(schema.tasks)
    .values({
      workspaceId: m.workspaceId,
      creatorId: m.userId,
      parentId: state.parentId,
      title: text.slice(0, 200),
      priority: parent.priority,
      status: "open",
    })
    .returning({ id: schema.tasks.id });
  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "create",
    entity: "task",
    entityId: child!.id,
    diff: { parentId: state.parentId },
  });
  await clearState(chatId, tg.id);
  await ctx.reply(`✅ Subtask <b>#${child!.id}</b> created.`, { parse_mode: "HTML" });
  await renderTask(ctx, state.parentId);
}

async function startWorkTimer(ctx: Context, taskId: number, userId: number) {
  const r = redis();
  if (!r) {
    await ctx.answerCallbackQuery({ text: "Timers require Redis." }).catch(() => {});
    return;
  }
  await r.set(`timer:${userId}:${taskId}`, Date.now(), { ex: 60 * 60 * 12 });
  // Also flip task to in_progress if not done
  await db()
    .update(schema.tasks)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));
  await renderTask(ctx, taskId);
}

async function stopWorkTimer(ctx: Context, taskId: number, userId: number, workspaceId: number) {
  const r = redis();
  if (!r) return;
  const startedAt = await r.get<number>(`timer:${userId}:${taskId}`);
  if (!startedAt) {
    await ctx.answerCallbackQuery({ text: "No timer running." }).catch(() => {});
    return;
  }
  const minutes = Math.max(1, Math.floor((Date.now() - Number(startedAt)) / 60000));
  await r.del(`timer:${userId}:${taskId}`);
  // Append a comment row recording the timer entry
  await db().insert(schema.comments).values({
    taskId,
    authorId: userId,
    body: `⏱️ Logged ${minutes} min`,
  });
  // Increment actual_minutes
  const current = await db().select({ actual: schema.tasks.actualMinutes }).from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  const next = (current[0]?.actual ?? 0) + minutes;
  await db().update(schema.tasks).set({ actualMinutes: next, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
  await audit({ workspaceId, actorId: userId, action: "update", entity: "task", entityId: taskId, diff: { loggedMinutes: minutes } });
  await renderTask(ctx, taskId);
}

// ----- helpers -----

async function loadTask(taskId: number, workspaceId: number) {
  const r = await db()
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, workspaceId)))
    .limit(1);
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
  return db()
    .select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.parentId, parentId), eq(schema.tasks.workspaceId, workspaceId)))
    .limit(20);
}

async function loadRecentComments(taskId: number) {
  const rows = await db()
    .select({
      body: schema.comments.body,
      createdAt: schema.comments.createdAt,
      first: schema.users.firstName,
      last: schema.users.lastName,
      uname: schema.users.telegramUsername,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(eq(schema.comments.taskId, taskId))
    .orderBy(desc(schema.comments.createdAt))
    .limit(3);
  return rows.reverse().map((r) => ({
    body: r.body,
    createdAt: r.createdAt,
    author: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "user"),
  }));
}

async function isWatching(taskId: number, userId: number): Promise<boolean> {
  const r = await db()
    .select({ taskId: schema.taskWatchers.taskId })
    .from(schema.taskWatchers)
    .where(and(eq(schema.taskWatchers.taskId, taskId), eq(schema.taskWatchers.userId, userId)))
    .limit(1);
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
        reply_markup: { inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${taskId}` }]] },
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
    } catch {
      // fall through
    }
  }
  await ctx.reply(text, opts);
}
