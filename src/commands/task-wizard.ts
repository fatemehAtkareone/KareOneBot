import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { setState, getState, clearState } from "@/lib/redis";
import { h, sendMessage } from "@/lib/telegram";
import { audit } from "@/lib/audit";
import { displayName } from "@/lib/users";
import { log } from "@/lib/logger";
import {
  priorityKb,
  dueDateKb,
  dueTimeKb,
  recurrenceKb,
  assigneeKb,
  confirmKb,
} from "@/lib/keyboards";

export type WizardStep =
  | "title"
  | "desc"
  | "priority"
  | "duedate"
  | "duetime"
  | "duecustom"
  | "timecustom"
  | "assignee"
  | "recurrence"
  | "confirm";

export interface NewTaskWizardState {
  flow: "newtask";
  step: WizardStep;
  data: {
    title?: string;
    description?: string;
    priority?: "p0" | "p1" | "p2" | "p3";
    dueDate?: string; // YYYY-MM-DD in workspace tz
    dueTime?: string; // HH:mm
    assigneeUserId?: number | "self" | "none";
    recurrenceRule?: string;
  };
  assigneePage?: number;
  workspaceId: number;
}

const TZ = "Asia/Tehran";

const PRIORITY_LABEL: Record<string, string> = {
  p0: "🔴 P0 — Urgent",
  p1: "🟠 P1 — High",
  p2: "🟡 P2 — Normal",
  p3: "🟢 P3 — Low",
};

const RECURRENCE_RULES: Record<string, { rule: string | null; label: string }> = {
  none: { rule: null, label: "None (one-off)" },
  daily: { rule: "FREQ=DAILY", label: "Daily" },
  weekdays: { rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,SA", label: "Weekdays (Sat–Thu)" },
  weekly: { rule: "FREQ=WEEKLY", label: "Weekly" },
  biweekly: { rule: "FREQ=WEEKLY;INTERVAL=2", label: "Bi-weekly" },
  monthly: { rule: "FREQ=MONTHLY", label: "Monthly" },
};

/** Entry: /newtask command */
export async function startWizard(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.reply("You're not part of any workspace yet. Ask your admin for an invite link.");
    return;
  }
  const chatId = ctx.chat!.id;
  const state: NewTaskWizardState = {
    flow: "newtask",
    step: "title",
    data: {},
    workspaceId: m.workspaceId,
  };
  await setState(chatId, tg.id, state);
  await ctx.reply(
    `📝 <b>Step 1 of 7 — Title</b>\nWhat is the task about? Send a short title.`,
    { parse_mode: "HTML" }
  );
}

/** Free-text input handler — invoked by router when wizard state present and message is plain text */
export async function handleTextInput(ctx: Context, state: NewTaskWizardState) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim() ?? "";

  switch (state.step) {
    case "title":
      if (!text) return;
      state.data.title = text.slice(0, 200);
      state.step = "desc";
      await setState(chatId, tg.id, state);
      await ctx.reply(
        `📝 <b>Step 2 of 7 — Description</b>\nAdd details, or tap Skip.`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "⏭️ Skip", callback_data: "nt:descskip" }]] },
        }
      );
      return;
    case "desc":
      state.data.description = text.slice(0, 4000);
      await advanceToPriority(ctx, state);
      return;
    case "duecustom": {
      const parsed = DateTime.fromFormat(text, "yyyy-LL-dd", { zone: TZ });
      if (!parsed.isValid) {
        await ctx.reply("Invalid date. Format: <code>YYYY-MM-DD</code> (e.g. 2026-05-15).", { parse_mode: "HTML" });
        return;
      }
      state.data.dueDate = parsed.toFormat("yyyy-LL-dd");
      await advanceToTime(ctx, state);
      return;
    }
    case "timecustom": {
      const m = text.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m) {
        await ctx.reply("Invalid time. Format: <code>HH:MM</code> (e.g. 17:30).", { parse_mode: "HTML" });
        return;
      }
      state.data.dueTime = `${m[1]!.padStart(2, "0")}:${m[2]}`;
      await advanceToAssignee(ctx, state);
      return;
    }
    default:
      // Ignore stray text in non-input steps
      return;
  }
}

/** Callback handler — invoked by router when callback_data starts with "nt:" */
export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const state = await getState<NewTaskWizardState>(chatId, tg.id);

  // Allow the very first "nt:new" entry without any pre-existing state
  if (parts[0] === "new") {
    await ctx.answerCallbackQuery().catch(() => {});
    await startWizard(ctx);
    return;
  }

  if (!state || state.flow !== "newtask") {
    await ctx.answerCallbackQuery({ text: "Wizard expired. Send /newtask to start over." }).catch(() => {});
    return;
  }

  const verb = parts[0]!;
  await ctx.answerCallbackQuery().catch(() => {});

  switch (verb) {
    case "cancel":
      await clearState(chatId, tg.id);
      await editOrReply(ctx, "❌ Task creation cancelled.");
      return;
    case "back":
      await goBack(ctx, state);
      return;
    case "descskip":
      state.data.description = undefined;
      await advanceToPriority(ctx, state);
      return;
    case "prio":
      state.data.priority = parts[1] as NewTaskWizardState["data"]["priority"];
      await setState(chatId, tg.id, state);
      await advanceToDueDate(ctx, state);
      return;
    case "due": {
      const v = parts[1]!;
      if (v === "none") {
        state.data.dueDate = undefined;
        state.data.dueTime = undefined;
        await advanceToAssignee(ctx, state);
        return;
      }
      if (v === "custom") {
        state.step = "duecustom";
        await setState(chatId, tg.id, state);
        await editOrReply(ctx, "Send the due date as <code>YYYY-MM-DD</code>:");
        return;
      }
      state.data.dueDate = computePresetDate(v);
      await advanceToTime(ctx, state);
      return;
    }
    case "time": {
      const v = parts[1]!;
      if (v === "custom") {
        state.step = "timecustom";
        await setState(chatId, tg.id, state);
        await editOrReply(ctx, "Send the time as <code>HH:MM</code>:");
        return;
      }
      // v is "HH:00" because the data path was nt:time:HH:00
      state.data.dueTime = `${parts[1]}:${parts[2] ?? "00"}`;
      await advanceToAssignee(ctx, state);
      return;
    }
    case "asgn": {
      const v = parts[1]!;
      if (v === "self" || v === "none") state.data.assigneeUserId = v;
      else state.data.assigneeUserId = Number(v);
      await advanceToRecurrence(ctx, state);
      return;
    }
    case "asgnpg": {
      state.assigneePage = Number(parts[1] ?? 0);
      await renderAssignee(ctx, state);
      return;
    }
    case "rec": {
      const key = parts[1]!;
      state.data.recurrenceRule = RECURRENCE_RULES[key]?.rule ?? undefined;
      await advanceToConfirm(ctx, state);
      return;
    }
    case "save":
      await saveAndFinish(ctx, state);
      return;
    case "edit": {
      const which = parts[1]!;
      const stepMap: Record<string, WizardStep> = {
        title: "title",
        desc: "desc",
        prio: "priority",
        due: "duedate",
        asgn: "assignee",
        rec: "recurrence",
      };
      const step = stepMap[which];
      if (!step) return;
      state.step = step;
      await setState(chatId, tg.id, state);
      switch (step) {
        case "title":
          await editOrReply(ctx, "Send a new title:");
          return;
        case "desc":
          await editOrReply(ctx, "Send a new description (or tap Skip):", {
            reply_markup: { inline_keyboard: [[{ text: "⏭️ Skip", callback_data: "nt:descskip" }]] },
          });
          return;
        case "priority":
          await renderPriority(ctx, state);
          return;
        case "duedate":
          await renderDueDate(ctx, state);
          return;
        case "assignee":
          await renderAssignee(ctx, state);
          return;
        case "recurrence":
          await renderRecurrence(ctx, state);
          return;
      }
      return;
    }
  }
}

// ----- step renderers -----

async function advanceToPriority(ctx: Context, state: NewTaskWizardState) {
  state.step = "priority";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderPriority(ctx, state);
}
async function renderPriority(ctx: Context, _state: NewTaskWizardState) {
  await editOrReply(ctx, `⚡ <b>Step 3 of 7 — Priority</b>\nHow important is this task?`, {
    reply_markup: { inline_keyboard: priorityKb() },
  });
}

async function advanceToDueDate(ctx: Context, state: NewTaskWizardState) {
  state.step = "duedate";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderDueDate(ctx, state);
}
async function renderDueDate(ctx: Context, _state: NewTaskWizardState) {
  await editOrReply(ctx, `📅 <b>Step 4 of 7 — Due date</b>\nWhen should this be done?`, {
    reply_markup: { inline_keyboard: dueDateKb() },
  });
}

async function advanceToTime(ctx: Context, state: NewTaskWizardState) {
  state.step = "duetime";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await editOrReply(ctx, `🕐 <b>Step 4 of 7 — Time of day</b>\nPick a time on ${h(state.data.dueDate ?? "")}.`, {
    reply_markup: { inline_keyboard: dueTimeKb() },
  });
}

async function advanceToAssignee(ctx: Context, state: NewTaskWizardState) {
  state.step = "assignee";
  state.assigneePage = 0;
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderAssignee(ctx, state);
}
async function renderAssignee(ctx: Context, state: NewTaskWizardState) {
  const members = await listWorkspaceMembers(state.workspaceId);
  await editOrReply(ctx, `👤 <b>Step 5 of 7 — Assignee</b>\nWho will work on this?`, {
    reply_markup: { inline_keyboard: assigneeKb(members, state.assigneePage ?? 0) },
  });
}

async function advanceToRecurrence(ctx: Context, state: NewTaskWizardState) {
  state.step = "recurrence";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderRecurrence(ctx, state);
}
async function renderRecurrence(ctx: Context, _state: NewTaskWizardState) {
  await editOrReply(ctx, `🔁 <b>Step 6 of 7 — Recurrence</b>\nDoes this repeat?`, {
    reply_markup: { inline_keyboard: recurrenceKb() },
  });
}

async function advanceToConfirm(ctx: Context, state: NewTaskWizardState) {
  state.step = "confirm";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderConfirm(ctx, state);
}
async function renderConfirm(ctx: Context, state: NewTaskWizardState) {
  const d = state.data;
  const assigneeName = await resolveAssigneeName(state.workspaceId, d.assigneeUserId, ctx.from!.id);
  const recurrenceLabel = (() => {
    if (!d.recurrenceRule) return "None";
    for (const k of Object.keys(RECURRENCE_RULES)) {
      if (RECURRENCE_RULES[k]!.rule === d.recurrenceRule) return RECURRENCE_RULES[k]!.label;
    }
    return d.recurrenceRule;
  })();
  const dueText = d.dueDate ? `${d.dueDate}${d.dueTime ? " " + d.dueTime : ""}` : "—";
  const lines = [
    `📋 <b>Step 7 of 7 — Review</b>`,
    ``,
    `<b>Title:</b> ${h(d.title ?? "—")}`,
    `<b>Description:</b> ${d.description ? h(d.description) : "—"}`,
    `<b>Priority:</b> ${PRIORITY_LABEL[d.priority ?? "p2"]}`,
    `<b>Due:</b> ${h(dueText)}`,
    `<b>Assignee:</b> ${h(assigneeName)}`,
    `<b>Recurrence:</b> ${h(recurrenceLabel)}`,
  ];
  await editOrReply(ctx, lines.join("\n"), {
    reply_markup: { inline_keyboard: confirmKb() },
  });
}

// ----- save + back -----

async function saveAndFinish(ctx: Context, state: NewTaskWizardState) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await editOrReply(ctx, "You're not a member of this workspace anymore.");
    await clearState(chatId, tg.id);
    return;
  }

  const dueAt = composeDueAt(state.data.dueDate, state.data.dueTime);

  let assigneeUserId: number | null = null;
  if (state.data.assigneeUserId === "self") assigneeUserId = m.userId;
  else if (typeof state.data.assigneeUserId === "number") assigneeUserId = state.data.assigneeUserId;

  const [task] = await db()
    .insert(schema.tasks)
    .values({
      workspaceId: m.workspaceId,
      creatorId: m.userId,
      title: state.data.title!,
      description: state.data.description ?? null,
      priority: state.data.priority ?? "p2",
      dueAt,
      status: assigneeUserId ? "assigned" : "open",
      recurrenceRule: state.data.recurrenceRule ?? null,
    })
    .returning({ id: schema.tasks.id });

  if (assigneeUserId) {
    await db().insert(schema.taskAssignees).values({ taskId: task!.id, userId: assigneeUserId });
    if (assigneeUserId !== m.userId) {
      const u = await db()
        .select({ telegramId: schema.users.telegramId })
        .from(schema.users)
        .where(eq(schema.users.id, assigneeUserId))
        .limit(1);
      if (u[0]) {
        await sendMessage(
          u[0].telegramId,
          `🆕 New task <b>#${task!.id}</b> — ${h(state.data.title ?? "")}\n\n<i>Assigned by ${h(displayName(tg))}</i>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${task!.id}` }]],
            },
          }
        ).catch((e) => log.warn("notify assignee failed", { err: String(e) }));
      }
    }
  }

  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "create",
    entity: "task",
    entityId: task!.id,
    diff: { ...state.data },
  });
  await clearState(chatId, tg.id);

  await editOrReply(
    ctx,
    `✅ Task <b>#${task!.id}</b> created.\n<b>${h(state.data.title ?? "")}</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Open task", callback_data: `t:view:${task!.id}` }],
          [{ text: "➕ New task", callback_data: "nt:new" }, { text: "📋 My tasks", callback_data: "lst:my:p:0" }],
        ],
      },
    }
  );
}

async function goBack(ctx: Context, state: NewTaskWizardState) {
  const order: WizardStep[] = ["title", "desc", "priority", "duedate", "duetime", "assignee", "recurrence", "confirm"];
  const idx = order.indexOf(state.step);
  if (idx <= 0) return;
  state.step = order[idx - 1]!;
  await setState(ctx.chat!.id, ctx.from!.id, state);
  switch (state.step) {
    case "title":
      await editOrReply(ctx, `📝 <b>Step 1 of 7 — Title</b>\nWhat is the task about?`);
      return;
    case "desc":
      await editOrReply(ctx, `📝 <b>Step 2 of 7 — Description</b>\nAdd details, or tap Skip.`, {
        reply_markup: { inline_keyboard: [[{ text: "⏭️ Skip", callback_data: "nt:descskip" }]] },
      });
      return;
    case "priority":
      await renderPriority(ctx, state);
      return;
    case "duedate":
      await renderDueDate(ctx, state);
      return;
    case "duetime":
      await editOrReply(ctx, `🕐 Pick a time on ${h(state.data.dueDate ?? "")}.`, {
        reply_markup: { inline_keyboard: dueTimeKb() },
      });
      return;
    case "assignee":
      await renderAssignee(ctx, state);
      return;
    case "recurrence":
      await renderRecurrence(ctx, state);
      return;
    case "confirm":
      await renderConfirm(ctx, state);
      return;
  }
}

// ----- helpers -----

function computePresetDate(key: string): string {
  const now = DateTime.now().setZone(TZ);
  switch (key) {
    case "today":
      return now.toFormat("yyyy-LL-dd");
    case "tomorrow":
      return now.plus({ days: 1 }).toFormat("yyyy-LL-dd");
    case "3d":
      return now.plus({ days: 3 }).toFormat("yyyy-LL-dd");
    case "fri":
      return now.set({ weekday: 5 }).toFormat("yyyy-LL-dd");
    case "nextmon":
      return now.plus({ weeks: 1 }).set({ weekday: 1 }).toFormat("yyyy-LL-dd");
    case "2w":
      return now.plus({ weeks: 2 }).toFormat("yyyy-LL-dd");
    default:
      return now.toFormat("yyyy-LL-dd");
  }
}

function composeDueAt(date?: string, time?: string): Date | null {
  if (!date) return null;
  const t = time ?? "17:00";
  const dt = DateTime.fromFormat(`${date} ${t}`, "yyyy-LL-dd HH:mm", { zone: TZ });
  return dt.isValid ? dt.toJSDate() : null;
}

async function listWorkspaceMembers(workspaceId: number): Promise<{ id: number; name: string }[]> {
  const rows = await db()
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
  return rows.map((r) => ({
    id: r.id,
    name:
      [r.first, r.last].filter(Boolean).join(" ") ||
      (r.uname ? `@${r.uname}` : `user#${r.id}`),
  }));
}

async function resolveAssigneeName(
  workspaceId: number,
  assigneeId: number | "self" | "none" | undefined,
  callerTelegramId: number
): Promise<string> {
  if (!assigneeId || assigneeId === "none") return "— Unassigned";
  if (assigneeId === "self") {
    const m = await getMembershipByTelegramId(callerTelegramId);
    if (!m) return "Self";
    const u = await db()
      .select({ first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
      .from(schema.users)
      .where(eq(schema.users.id, m.userId))
      .limit(1);
    if (!u[0]) return "Self";
    return [u[0].first, u[0].last].filter(Boolean).join(" ") || (u[0].uname ? `@${u[0].uname}` : "Self");
  }
  const u = await db()
    .select({ first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
    .from(schema.users)
    .where(eq(schema.users.id, Number(assigneeId)))
    .limit(1);
  if (!u[0]) return `user#${assigneeId}`;
  return [u[0].first, u[0].last].filter(Boolean).join(" ") || (u[0].uname ? `@${u[0].uname}` : `user#${assigneeId}`);
}

async function editOrReply(ctx: Context, text: string, extra?: Record<string, unknown>) {
  const opts = { parse_mode: "HTML" as const, ...extra };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch {
      // fall through to reply if edit fails (message too old etc.)
    }
  }
  await ctx.reply(text, opts);
}
