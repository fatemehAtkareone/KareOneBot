import type { InlineKeyboardButton } from "grammy/types";

/**
 * Reusable inline-keyboard builders.
 *
 * callback_data is limited to 64 bytes by Telegram. We use compact
 * colon-separated namespaces:  ns:verb:arg1:arg2 ...
 * Namespaces:
 *   t   = task action          t:done:123, t:reassign:123, t:prio:123:p1
 *   nt  = new-task wizard      nt:prio:p1, nt:due:tomorrow, nt:asgn:42
 *   lst = list/pagination      lst:my:p:2, lst:my:f:today, lst:my:s:due
 *   set = settings             set:lang:fa, set:digest:on
 *   lang = language picker     lang:fa, lang:en
 *   q   = question/answer      q:answer:42
 *   noop = swallow              noop
 */

export type Btn = InlineKeyboardButton;
export const noop: Btn = { text: " ", callback_data: "noop" };

export function row(...btns: Btn[]): Btn[] { return btns; }
export function grid(buttons: Btn[], cols: number): Btn[][] {
  const rows: Btn[][] = [];
  for (let i = 0; i < buttons.length; i += cols) rows.push(buttons.slice(i, i + cols));
  return rows;
}

// ---------- Wizard keyboards ----------
export function priorityKb(): Btn[][] {
  return [
    [
      { text: "🔴 P0 — Urgent", callback_data: "nt:prio:p0" },
      { text: "🟠 P1 — High", callback_data: "nt:prio:p1" },
    ],
    [
      { text: "🟡 P2 — Normal", callback_data: "nt:prio:p2" },
      { text: "🟢 P3 — Low", callback_data: "nt:prio:p3" },
    ],
    [navRow("nt", { skip: false, back: true })].flat(),
  ];
}

export function dueDateKb(): Btn[][] {
  return [
    [
      { text: "📅 Today", callback_data: "nt:due:today" },
      { text: "📅 Tomorrow", callback_data: "nt:due:tomorrow" },
    ],
    [
      { text: "📅 In 3 days", callback_data: "nt:due:3d" },
      { text: "📅 This Friday", callback_data: "nt:due:fri" },
    ],
    [
      { text: "📅 Next Monday", callback_data: "nt:due:nextmon" },
      { text: "📅 In 2 weeks", callback_data: "nt:due:2w" },
    ],
    [
      { text: "✏️ Custom date", callback_data: "nt:due:custom" },
      { text: "⏭️ No due date", callback_data: "nt:due:none" },
    ],
    navRow("nt", { skip: false, back: true }),
  ];
}

export function dueTimeKb(): Btn[][] {
  return [
    [
      { text: "🕘 9:00", callback_data: "nt:time:09:00" },
      { text: "🕛 12:00", callback_data: "nt:time:12:00" },
      { text: "🕐 13:00", callback_data: "nt:time:13:00" },
    ],
    [
      { text: "🕓 16:00", callback_data: "nt:time:16:00" },
      { text: "🕔 17:00", callback_data: "nt:time:17:00" },
      { text: "🕘 21:00", callback_data: "nt:time:21:00" },
    ],
    [
      { text: "🌅 Morning (09:00)", callback_data: "nt:time:09:00" },
      { text: "🌃 End of day (23:59)", callback_data: "nt:time:23:59" },
    ],
    [
      { text: "✏️ Custom time", callback_data: "nt:time:custom" },
    ],
    navRow("nt", { skip: false, back: true }),
  ];
}

export function recurrenceKb(): Btn[][] {
  return [
    [
      { text: "🚫 None (one-off)", callback_data: "nt:rec:none" },
      { text: "📆 Daily", callback_data: "nt:rec:daily" },
    ],
    [
      { text: "📅 Weekdays", callback_data: "nt:rec:weekdays" },
      { text: "📅 Weekly", callback_data: "nt:rec:weekly" },
    ],
    [
      { text: "📅 Bi-weekly", callback_data: "nt:rec:biweekly" },
      { text: "📅 Monthly", callback_data: "nt:rec:monthly" },
    ],
    navRow("nt", { skip: false, back: true }),
  ];
}

export function assigneeKb(members: { id: number; name: string }[], page = 0): Btn[][] {
  const PER_PAGE = 6;
  const start = page * PER_PAGE;
  const slice = members.slice(start, start + PER_PAGE);
  const rows: Btn[][] = [];
  rows.push([
    { text: "🙋 Assign to me", callback_data: "nt:asgn:self" },
    { text: "👥 Unassigned", callback_data: "nt:asgn:none" },
  ]);
  for (const m of slice) rows.push([{ text: `👤 ${m.name}`, callback_data: `nt:asgn:${m.id}` }]);
  const nav: Btn[] = [];
  if (start > 0) nav.push({ text: "⬅️ Prev", callback_data: `nt:asgnpg:${page - 1}` });
  if (start + PER_PAGE < members.length) nav.push({ text: "Next ➡️", callback_data: `nt:asgnpg:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push(navRow("nt", { skip: false, back: true }));
  return rows;
}

export function confirmKb(): Btn[][] {
  return [
    [
      { text: "✅ Create task", callback_data: "nt:save" },
    ],
    [
      { text: "✏️ Edit title", callback_data: "nt:edit:title" },
      { text: "✏️ Edit desc", callback_data: "nt:edit:desc" },
    ],
    [
      { text: "✏️ Priority", callback_data: "nt:edit:prio" },
      { text: "✏️ Due", callback_data: "nt:edit:due" },
    ],
    [
      { text: "✏️ Assignee", callback_data: "nt:edit:asgn" },
      { text: "✏️ Recurrence", callback_data: "nt:edit:rec" },
    ],
    [{ text: "❌ Cancel", callback_data: "nt:cancel" }],
  ];
}

// ---------- Task action keyboards ----------
export function taskActionsKb(taskId: number, status: string, watching: boolean): Btn[][] {
  const id = taskId;
  const statusRow: Btn[] = [];
  if (status !== "in_progress") statusRow.push({ text: "▶️ Start", callback_data: `t:start:${id}` });
  if (status === "in_progress") statusRow.push({ text: "⏸️ Block", callback_data: `t:block:${id}` });
  if (status !== "in_review" && status !== "done") statusRow.push({ text: "👀 Review", callback_data: `t:review:${id}` });
  if (status !== "done") statusRow.push({ text: "✅ Done", callback_data: `t:done:${id}` });
  return [
    statusRow.length ? statusRow : [{ text: "🔁 Reopen", callback_data: `t:reopen:${id}` }],
    [
      { text: "👤 Reassign", callback_data: `t:reassign:${id}` },
      { text: "📅 Reschedule", callback_data: `t:resched:${id}` },
    ],
    [
      { text: "⚡ Priority", callback_data: `t:prio:${id}` },
      { text: "🏷️ Labels", callback_data: `t:lbl:${id}` },
    ],
    [
      { text: "💬 Comment", callback_data: `t:cmt:${id}` },
      { text: "➕ Subtask", callback_data: `t:sub:${id}` },
    ],
    [
      { text: "⏰ Snooze", callback_data: `t:snz:${id}` },
      { text: watching ? "🔕 Unwatch" : "👁️ Watch", callback_data: `t:${watching ? "unwatch" : "watch"}:${id}` },
    ],
    [
      { text: "⏱️ Start timer", callback_data: `t:wstart:${id}` },
      { text: "⏹️ Stop timer", callback_data: `t:wstop:${id}` },
    ],
    [
      { text: "🔄 Refresh", callback_data: `t:view:${id}` },
      { text: "❌ Cancel task", callback_data: `t:tcancel:${id}` },
    ],
  ];
}

export function priorityChooseKb(taskId: number): Btn[][] {
  return [
    [
      { text: "🔴 P0", callback_data: `t:setprio:${taskId}:p0` },
      { text: "🟠 P1", callback_data: `t:setprio:${taskId}:p1` },
      { text: "🟡 P2", callback_data: `t:setprio:${taskId}:p2` },
      { text: "🟢 P3", callback_data: `t:setprio:${taskId}:p3` },
    ],
    [{ text: "⬅️ Back", callback_data: `t:view:${taskId}` }],
  ];
}

export function snoozeKb(taskId: number): Btn[][] {
  return [
    [
      { text: "⏰ +1 hour", callback_data: `t:setsnz:${taskId}:1h` },
      { text: "⏰ +3 hours", callback_data: `t:setsnz:${taskId}:3h` },
    ],
    [
      { text: "📅 Tomorrow 9am", callback_data: `t:setsnz:${taskId}:tom9` },
      { text: "📅 Next Monday", callback_data: `t:setsnz:${taskId}:mon9` },
    ],
    [{ text: "⬅️ Back", callback_data: `t:view:${taskId}` }],
  ];
}

export function reschedKb(taskId: number): Btn[][] {
  return [
    [
      { text: "📅 Today", callback_data: `t:setdue:${taskId}:today` },
      { text: "📅 Tomorrow", callback_data: `t:setdue:${taskId}:tomorrow` },
    ],
    [
      { text: "📅 In 3 days", callback_data: `t:setdue:${taskId}:3d` },
      { text: "📅 This Friday", callback_data: `t:setdue:${taskId}:fri` },
    ],
    [
      { text: "📅 Next Monday", callback_data: `t:setdue:${taskId}:nextmon` },
      { text: "🚫 Clear due", callback_data: `t:setdue:${taskId}:none` },
    ],
    [{ text: "⬅️ Back", callback_data: `t:view:${taskId}` }],
  ];
}

export function reassignKb(taskId: number, members: { id: number; name: string }[], page = 0): Btn[][] {
  const PER_PAGE = 6;
  const start = page * PER_PAGE;
  const slice = members.slice(start, start + PER_PAGE);
  const rows: Btn[][] = [];
  rows.push([{ text: "🙋 To me", callback_data: `t:setasgn:${taskId}:self` }]);
  for (const m of slice) rows.push([{ text: `👤 ${m.name}`, callback_data: `t:setasgn:${taskId}:${m.id}` }]);
  const nav: Btn[] = [];
  if (start > 0) nav.push({ text: "⬅️ Prev", callback_data: `t:rapg:${taskId}:${page - 1}` });
  if (start + PER_PAGE < members.length) nav.push({ text: "Next ➡️", callback_data: `t:rapg:${taskId}:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "⬅️ Back", callback_data: `t:view:${taskId}` }]);
  return rows;
}

// ---------- Task list keyboard ----------
export function taskListKb(
  tasks: { id: number; title: string }[],
  filter: string,
  sort: string,
  page: number,
  hasNext: boolean
): Btn[][] {
  const rows: Btn[][] = [];

  // Filter row
  rows.push([
    btnToggle("📥 All", filter === "all", `lst:my:f:all`),
    btnToggle("📅 Today", filter === "today", `lst:my:f:today`),
    btnToggle("🚨 Overdue", filter === "overdue", `lst:my:f:overdue`),
  ]);
  rows.push([
    btnToggle("🗓️ Week", filter === "week", `lst:my:f:week`),
    btnToggle("✅ Done", filter === "done", `lst:my:f:done`),
    btnToggle("👁️ Watching", filter === "watching", `lst:my:f:watching`),
  ]);

  // Task rows: each task is a button to view detail
  for (const tk of tasks) {
    const label = tk.title.length > 50 ? tk.title.slice(0, 47) + "…" : tk.title;
    rows.push([{ text: `#${tk.id} · ${label}`, callback_data: `t:view:${tk.id}` }]);
  }

  // Sort row
  rows.push([
    btnToggle("⏰ Due", sort === "due", `lst:my:s:due`),
    btnToggle("⚡ Priority", sort === "prio", `lst:my:s:prio`),
    btnToggle("🆕 Newest", sort === "new", `lst:my:s:new`),
  ]);

  // Pagination row
  const nav: Btn[] = [];
  if (page > 0) nav.push({ text: "⬅️ Prev", callback_data: `lst:my:p:${page - 1}` });
  nav.push({ text: `· ${page + 1} ·`, callback_data: "noop" });
  if (hasNext) nav.push({ text: "Next ➡️", callback_data: `lst:my:p:${page + 1}` });
  rows.push(nav);

  rows.push([{ text: "➕ New task", callback_data: "nt:new" }, { text: "🔄 Refresh", callback_data: `lst:my:p:${page}` }]);
  return rows;
}

function btnToggle(text: string, active: boolean, cb: string): Btn {
  return { text: active ? `· ${text} ·` : text, callback_data: cb };
}

// ---------- Settings keyboard ----------
export function settingsKb(): Btn[][] {
  return [
    [{ text: "🌐 Language", callback_data: "set:menu:lang" }],
    [{ text: "🔔 Notifications", callback_data: "set:menu:notif" }],
    [{ text: "🌙 Quiet hours", callback_data: "set:menu:quiet" }],
    [{ text: "🕒 Timezone", callback_data: "set:menu:tz" }],
    [{ text: "✖️ Close", callback_data: "set:close" }],
  ];
}

export function languagePickerKb(): Btn[][] {
  return [
    [
      { text: "🇮🇷 فارسی", callback_data: "lang:fa" },
      { text: "🇬🇧 English", callback_data: "lang:en" },
    ],
    [{ text: "⬅️ Back", callback_data: "set:menu:root" }],
  ];
}

export function notifKb(prefs: { digestEnabled: boolean }): Btn[][] {
  return [
    [
      { text: prefs.digestEnabled ? "✅ Daily digest" : "⬜ Daily digest", callback_data: "set:notif:digest" },
    ],
    [{ text: "⬅️ Back", callback_data: "set:menu:root" }],
  ];
}

export function quietHoursKb(): Btn[][] {
  return [
    [
      { text: "🌙 22:00 → 08:00", callback_data: "set:quiet:22-08" },
      { text: "🌙 23:00 → 07:00", callback_data: "set:quiet:23-07" },
    ],
    [
      { text: "🌙 21:00 → 09:00", callback_data: "set:quiet:21-09" },
      { text: "☀️ Disable", callback_data: "set:quiet:off" },
    ],
    [{ text: "⬅️ Back", callback_data: "set:menu:root" }],
  ];
}

// ---------- Helpers ----------
export function navRow(ns: string, opts: { skip?: boolean; back?: boolean; cancel?: boolean } = {}): Btn[] {
  const r: Btn[] = [];
  if (opts.back) r.push({ text: "⬅️ Back", callback_data: `${ns}:back` });
  if (opts.skip) r.push({ text: "⏭️ Skip", callback_data: `${ns}:skip` });
  r.push({ text: "❌ Cancel", callback_data: `${ns}:cancel` });
  return r;
}
