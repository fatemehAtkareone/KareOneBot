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
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import {
  priorityKb,
  dueDateKb,
  dueTimeKb,
  recurrenceKb,
  assigneeKb,
  confirmKb,
  projectPickerKb,
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
  | "project"
  | "recurrence"
  | "confirm";

export interface NewTaskWizardState {
  flow: "newtask";
  step: WizardStep;
  data: {
    title?: string;
    description?: string;
    priority?: "p0" | "p1" | "p2" | "p3";
    dueDate?: string;
    dueTime?: string;
    assigneeUserId?: number | "self" | "none";
    projectId?: number | "none";
    recurrenceRule?: string;
  };
  assigneePage?: number;
  workspaceId: number;
}

const TZ = "Asia/Tehran";

const PRIORITY_KEYS: Record<string, string> = {
  p0: "btn_p0", p1: "btn_p1", p2: "btn_p2", p3: "btn_p3",
};

const RECURRENCE_RULES: Record<string, { rule: string | null; labelKey: string }> = {
  none: { rule: null, labelKey: "rec_label_none" },
  daily: { rule: "FREQ=DAILY", labelKey: "rec_label_daily" },
  weekdays: { rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,SA", labelKey: "rec_label_weekdays" },
  weekly: { rule: "FREQ=WEEKLY", labelKey: "rec_label_weekly" },
  biweekly: { rule: "FREQ=WEEKLY;INTERVAL=2", labelKey: "rec_label_biweekly" },
  monthly: { rule: "FREQ=MONTHLY", labelKey: "rec_label_monthly" },
};

export async function startWizard(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.reply(t(lc, "not_member"));
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
  await ctx.reply(t(lc, "wizard_title_step"), { parse_mode: "HTML" });
}

export async function handleTextInput(ctx: Context, state: NewTaskWizardState) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text?.trim() ?? "";

  switch (state.step) {
    case "title":
      if (!text) return;
      state.data.title = text.slice(0, 200);
      state.step = "desc";
      await setState(chatId, tg.id, state);
      await ctx.reply(t(lc, "wizard_desc_step"), {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: t(lc, "skip"), callback_data: "nt:descskip" }]] },
      });
      return;
    case "desc":
      state.data.description = text.slice(0, 4000);
      await advanceToPriority(ctx, lc, state);
      return;
    case "duecustom": {
      const parsed = DateTime.fromFormat(text, "yyyy-LL-dd", { zone: TZ });
      if (!parsed.isValid) {
        await ctx.reply(t(lc, "wizard_invalid_date"), { parse_mode: "HTML" });
        return;
      }
      state.data.dueDate = parsed.toFormat("yyyy-LL-dd");
      await advanceToTime(ctx, lc, state);
      return;
    }
    case "timecustom": {
      const m = text.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m) {
        await ctx.reply(t(lc, "wizard_invalid_time"), { parse_mode: "HTML" });
        return;
      }
      state.data.dueTime = `${m[1]!.padStart(2, "0")}:${m[2]}`;
      await advanceToAssignee(ctx, lc, state);
      return;
    }
    default:
      return;
  }
}

export async function handleCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const chatId = ctx.chat!.id;
  const state = await getState<NewTaskWizardState>(chatId, tg.id);

  if (parts[0] === "new") {
    await ctx.answerCallbackQuery().catch(() => {});
    await startWizard(ctx);
    return;
  }

  if (!state || state.flow !== "newtask") {
    await ctx.answerCallbackQuery({ text: t(lc, "wizard_expired") }).catch(() => {});
    return;
  }

  const verb = parts[0]!;
  await ctx.answerCallbackQuery().catch(() => {});

  switch (verb) {
    case "cancel":
      await clearState(chatId, tg.id);
      await editOrReply(ctx, t(lc, "wizard_cancelled"));
      return;
    case "back":
      await goBack(ctx, lc, state);
      return;
    case "descskip":
      state.data.description = undefined;
      await advanceToPriority(ctx, lc, state);
      return;
    case "prio":
      state.data.priority = parts[1] as NewTaskWizardState["data"]["priority"];
      await setState(chatId, tg.id, state);
      await advanceToDueDate(ctx, lc, state);
      return;
    case "due": {
      const v = parts[1]!;
      if (v === "none") {
        state.data.dueDate = undefined;
        state.data.dueTime = undefined;
        await advanceToAssignee(ctx, lc, state);
        return;
      }
      if (v === "custom") {
        state.step = "duecustom";
        await setState(chatId, tg.id, state);
        await editOrReply(ctx, t(lc, "wizard_send_date"));
        return;
      }
      state.data.dueDate = computePresetDate(v);
      await advanceToTime(ctx, lc, state);
      return;
    }
    case "time": {
      const v = parts[1]!;
      if (v === "custom") {
        state.step = "timecustom";
        await setState(chatId, tg.id, state);
        await editOrReply(ctx, t(lc, "wizard_send_time"));
        return;
      }
      state.data.dueTime = `${parts[1]}:${parts[2] ?? "00"}`;
      await advanceToAssignee(ctx, lc, state);
      return;
    }
    case "asgn": {
      const v = parts[1]!;
      if (v === "self" || v === "none") state.data.assigneeUserId = v;
      else state.data.assigneeUserId = Number(v);
      await advanceToProject(ctx, lc, state);
      return;
    }
    case "asgnpg": {
      state.assigneePage = Number(parts[1] ?? 0);
      await renderAssignee(ctx, lc, state);
      return;
    }
    case "proj": {
      const v = parts[1]!;
      state.data.projectId = v === "none" ? "none" : Number(v);
      await advanceToRecurrence(ctx, lc, state);
      return;
    }
    case "rec": {
      const key = parts[1]!;
      state.data.recurrenceRule = RECURRENCE_RULES[key]?.rule ?? undefined;
      await advanceToConfirm(ctx, lc, state);
      return;
    }
    case "save":
      await saveAndFinish(ctx, lc, state);
      return;
    case "edit": {
      const which = parts[1]!;
      const stepMap: Record<string, WizardStep> = {
        title: "title", desc: "desc", prio: "priority",
        due: "duedate", asgn: "assignee", rec: "recurrence",
      };
      const step = stepMap[which];
      if (!step) return;
      state.step = step;
      await setState(chatId, tg.id, state);
      switch (step) {
        case "title":
          await editOrReply(ctx, t(lc, "wizard_send_new_title"));
          return;
        case "desc":
          await editOrReply(ctx, t(lc, "wizard_send_new_desc"), {
            reply_markup: { inline_keyboard: [[{ text: t(lc, "skip"), callback_data: "nt:descskip" }]] },
          });
          return;
        case "priority":
          await renderPriority(ctx, lc);
          return;
        case "duedate":
          await renderDueDate(ctx, lc);
          return;
        case "assignee":
          await renderAssignee(ctx, lc, state);
          return;
        case "recurrence":
          await renderRecurrence(ctx, lc);
          return;
      }
      return;
    }
  }
}

// ---------- step renderers ----------
async function advanceToPriority(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "priority";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderPriority(ctx, lc);
}
async function renderPriority(ctx: Context, lc: string) {
  await editOrReply(ctx, t(lc, "wizard_priority_step"), { reply_markup: { inline_keyboard: priorityKb(lc) } });
}

async function advanceToDueDate(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "duedate";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderDueDate(ctx, lc);
}
async function renderDueDate(ctx: Context, lc: string) {
  await editOrReply(ctx, t(lc, "wizard_due_step"), { reply_markup: { inline_keyboard: dueDateKb(lc) } });
}

async function advanceToTime(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "duetime";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await editOrReply(ctx, t(lc, "wizard_time_step", { date: h(state.data.dueDate ?? "") }), {
    reply_markup: { inline_keyboard: dueTimeKb(lc) },
  });
}

async function advanceToAssignee(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "assignee";
  state.assigneePage = 0;
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderAssignee(ctx, lc, state);
}
async function renderAssignee(ctx: Context, lc: string, state: NewTaskWizardState) {
  const members = await listWorkspaceMembers(state.workspaceId);
  await editOrReply(ctx, t(lc, "wizard_assignee_step"), {
    reply_markup: { inline_keyboard: assigneeKb(lc, members, state.assigneePage ?? 0) },
  });
}

async function advanceToProject(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "project";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  const projects = await db()
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, state.workspaceId), eq(schema.projects.archived, false)))
    .limit(20);
  // If no projects exist, skip the step entirely
  if (projects.length === 0) {
    state.data.projectId = "none";
    await advanceToRecurrence(ctx, lc, state);
    return;
  }
  await editOrReply(ctx, t(lc, "wizard_project_step"), {
    reply_markup: { inline_keyboard: projectPickerKb(lc, projects) },
  });
}

async function advanceToRecurrence(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "recurrence";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderRecurrence(ctx, lc);
}
async function renderRecurrence(ctx: Context, lc: string) {
  await editOrReply(ctx, t(lc, "wizard_recurrence_step"), { reply_markup: { inline_keyboard: recurrenceKb(lc) } });
}

async function advanceToConfirm(ctx: Context, lc: string, state: NewTaskWizardState) {
  state.step = "confirm";
  await setState(ctx.chat!.id, ctx.from!.id, state);
  await renderConfirm(ctx, lc, state);
}
async function renderConfirm(ctx: Context, lc: string, state: NewTaskWizardState) {
  const d = state.data;
  const assigneeName = await resolveAssigneeName(state.workspaceId, d.assigneeUserId, ctx.from!.id, lc);
  const recurrenceLabel = (() => {
    if (!d.recurrenceRule) return t(lc, "rec_label_none");
    for (const k of Object.keys(RECURRENCE_RULES)) {
      if (RECURRENCE_RULES[k]!.rule === d.recurrenceRule) return t(lc, RECURRENCE_RULES[k]!.labelKey);
    }
    return d.recurrenceRule;
  })();
  const dueText = d.dueDate ? `${d.dueDate}${d.dueTime ? " " + d.dueTime : ""}` : "—";
  const lines = [
    t(lc, "wizard_review_step"),
    "",
    `<b>${t(lc, "wizard_field_title")}:</b> ${h(d.title ?? "—")}`,
    `<b>${t(lc, "wizard_field_desc")}:</b> ${d.description ? h(d.description) : "—"}`,
    `<b>${t(lc, "wizard_field_priority")}:</b> ${t(lc, PRIORITY_KEYS[d.priority ?? "p2"]!)}`,
    `<b>${t(lc, "wizard_field_due")}:</b> ${h(dueText)}`,
    `<b>${t(lc, "wizard_field_assignee")}:</b> ${h(assigneeName)}`,
    `<b>${t(lc, "wizard_field_recurrence")}:</b> ${h(recurrenceLabel)}`,
  ];
  await editOrReply(ctx, lines.join("\n"), { reply_markup: { inline_keyboard: confirmKb(lc) } });
}

async function saveAndFinish(ctx: Context, lc: string, state: NewTaskWizardState) {
  const tg = ctx.from!;
  const chatId = ctx.chat!.id;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await editOrReply(ctx, t(lc, "not_member"));
    await clearState(chatId, tg.id);
    return;
  }

  const dueAt = composeDueAt(state.data.dueDate, state.data.dueTime);

  let assigneeUserId: number | null = null;
  if (state.data.assigneeUserId === "self") assigneeUserId = m.userId;
  else if (typeof state.data.assigneeUserId === "number") assigneeUserId = state.data.assigneeUserId;

  const projectId = typeof state.data.projectId === "number" ? state.data.projectId : null;

  const [task] = await db()
    .insert(schema.tasks)
    .values({
      workspaceId: m.workspaceId,
      creatorId: m.userId,
      projectId,
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
          t(lc, "task_assigned_dm", { id: String(task!.id), title: h(state.data.title ?? "") }) +
            `\n\n<i>${h(displayName(tg))}</i>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: t(lc, "btn_view_task"), callback_data: `t:view:${task!.id}` }]],
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
    `${t(lc, "task_created", { id: String(task!.id), title: h(state.data.title ?? "") })}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: t(lc, "btn_open_task"), callback_data: `t:view:${task!.id}` }],
          [{ text: t(lc, "btn_new_task"), callback_data: "nt:new" }, { text: t(lc, "btn_my_tasks"), callback_data: "lst:my:p:0" }],
        ],
      },
    }
  );
}

async function goBack(ctx: Context, lc: string, state: NewTaskWizardState) {
  const order: WizardStep[] = ["title", "desc", "priority", "duedate", "duetime", "assignee", "project", "recurrence", "confirm"];
  const idx = order.indexOf(state.step);
  if (idx <= 0) return;
  state.step = order[idx - 1]!;
  await setState(ctx.chat!.id, ctx.from!.id, state);
  switch (state.step) {
    case "title": return editOrReply(ctx, t(lc, "wizard_title_step"));
    case "desc":
      return editOrReply(ctx, t(lc, "wizard_desc_step"), {
        reply_markup: { inline_keyboard: [[{ text: t(lc, "skip"), callback_data: "nt:descskip" }]] },
      });
    case "priority": return renderPriority(ctx, lc);
    case "duedate": return renderDueDate(ctx, lc);
    case "duetime":
      return editOrReply(ctx, t(lc, "wizard_time_step", { date: h(state.data.dueDate ?? "") }), {
        reply_markup: { inline_keyboard: dueTimeKb(lc) },
      });
    case "assignee": return renderAssignee(ctx, lc, state);
    case "project": return advanceToProject(ctx, lc, state);
    case "recurrence": return renderRecurrence(ctx, lc);
    case "confirm": return renderConfirm(ctx, lc, state);
  }
}

function computePresetDate(key: string): string {
  const now = DateTime.now().setZone(TZ);
  switch (key) {
    case "today": return now.toFormat("yyyy-LL-dd");
    case "tomorrow": return now.plus({ days: 1 }).toFormat("yyyy-LL-dd");
    case "3d": return now.plus({ days: 3 }).toFormat("yyyy-LL-dd");
    case "fri": return now.set({ weekday: 5 }).toFormat("yyyy-LL-dd");
    case "nextmon": return now.plus({ weeks: 1 }).set({ weekday: 1 }).toFormat("yyyy-LL-dd");
    case "2w": return now.plus({ weeks: 2 }).toFormat("yyyy-LL-dd");
    default: return now.toFormat("yyyy-LL-dd");
  }
}
function composeDueAt(date?: string, time?: string): Date | null {
  if (!date) return null;
  const tt = time ?? "17:00";
  const dt = DateTime.fromFormat(`${date} ${tt}`, "yyyy-LL-dd HH:mm", { zone: TZ });
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
    name: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : `user#${r.id}`),
  }));
}

async function resolveAssigneeName(
  workspaceId: number,
  assigneeId: number | "self" | "none" | undefined,
  callerTelegramId: number,
  lc: string
): Promise<string> {
  if (!assigneeId || assigneeId === "none") return t(lc, "wizard_unassigned");
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
    } catch { /* noop */ }
  }
  await ctx.reply(text, opts);
}
