import type { InlineKeyboardButton } from "grammy/types";
import { t } from "@/i18n";

export type Btn = InlineKeyboardButton;
export const noop: Btn = { text: " ", callback_data: "noop" };
export type LC = string;

export function row(...btns: Btn[]): Btn[] { return btns; }
export function grid(buttons: Btn[], cols: number): Btn[][] {
  const rows: Btn[][] = [];
  for (let i = 0; i < buttons.length; i += cols) rows.push(buttons.slice(i, i + cols));
  return rows;
}

// ---------- Wizard keyboards ----------
export function priorityKb(lc: LC): Btn[][] {
  return [
    [
      { text: t(lc, "btn_p0"), callback_data: "nt:prio:p0" },
      { text: t(lc, "btn_p1"), callback_data: "nt:prio:p1" },
    ],
    [
      { text: t(lc, "btn_p2"), callback_data: "nt:prio:p2" },
      { text: t(lc, "btn_p3"), callback_data: "nt:prio:p3" },
    ],
    navRow("nt", lc, { back: true }),
  ];
}

export function dueDateKb(lc: LC): Btn[][] {
  return [
    [
      { text: t(lc, "btn_today"), callback_data: "nt:due:today" },
      { text: t(lc, "btn_tomorrow"), callback_data: "nt:due:tomorrow" },
    ],
    [
      { text: t(lc, "btn_in3d"), callback_data: "nt:due:3d" },
      { text: t(lc, "btn_thisfri"), callback_data: "nt:due:fri" },
    ],
    [
      { text: t(lc, "btn_nextmon"), callback_data: "nt:due:nextmon" },
      { text: t(lc, "btn_in2w"), callback_data: "nt:due:2w" },
    ],
    [
      { text: t(lc, "btn_custom_date"), callback_data: "nt:due:custom" },
      { text: t(lc, "btn_no_due"), callback_data: "nt:due:none" },
    ],
    navRow("nt", lc, { back: true }),
  ];
}

export function dueTimeKb(lc: LC): Btn[][] {
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
      { text: t(lc, "btn_morning"), callback_data: "nt:time:09:00" },
      { text: t(lc, "btn_eod"), callback_data: "nt:time:23:59" },
    ],
    [
      { text: t(lc, "btn_custom_time"), callback_data: "nt:time:custom" },
    ],
    navRow("nt", lc, { back: true }),
  ];
}

export function recurrenceKb(lc: LC): Btn[][] {
  return [
    [
      { text: t(lc, "btn_rec_none"), callback_data: "nt:rec:none" },
      { text: t(lc, "btn_rec_daily"), callback_data: "nt:rec:daily" },
    ],
    [
      { text: t(lc, "btn_rec_weekdays"), callback_data: "nt:rec:weekdays" },
      { text: t(lc, "btn_rec_weekly"), callback_data: "nt:rec:weekly" },
    ],
    [
      { text: t(lc, "btn_rec_biweekly"), callback_data: "nt:rec:biweekly" },
      { text: t(lc, "btn_rec_monthly"), callback_data: "nt:rec:monthly" },
    ],
    navRow("nt", lc, { back: true }),
  ];
}

export function projectPickerKb(lc: LC, projects: { id: number; name: string }[]): Btn[][] {
  const rows: Btn[][] = [];
  rows.push([{ text: t(lc, "proj_btn_no_project"), callback_data: "nt:proj:none" }]);
  for (const p of projects.slice(0, 12)) {
    rows.push([{ text: `🗂️ ${p.name}`, callback_data: `nt:proj:${p.id}` }]);
  }
  rows.push(navRow("nt", lc, { back: true }));
  return rows;
}

export function assigneeKb(lc: LC, members: { id: number; name: string }[], page = 0): Btn[][] {
  const PER_PAGE = 6;
  const start = page * PER_PAGE;
  const slice = members.slice(start, start + PER_PAGE);
  const rows: Btn[][] = [];
  rows.push([
    { text: t(lc, "btn_assign_self"), callback_data: "nt:asgn:self" },
    { text: t(lc, "btn_assign_none"), callback_data: "nt:asgn:none" },
  ]);
  for (const m of slice) rows.push([{ text: `👤 ${m.name}`, callback_data: `nt:asgn:${m.id}` }]);
  const nav: Btn[] = [];
  if (start > 0) nav.push({ text: t(lc, "btn_prev"), callback_data: `nt:asgnpg:${page - 1}` });
  if (start + PER_PAGE < members.length) nav.push({ text: t(lc, "btn_next"), callback_data: `nt:asgnpg:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push(navRow("nt", lc, { back: true }));
  return rows;
}

export function confirmKb(lc: LC): Btn[][] {
  return [
    [{ text: t(lc, "btn_create"), callback_data: "nt:save" }],
    [
      { text: t(lc, "btn_edit_title"), callback_data: "nt:edit:title" },
      { text: t(lc, "btn_edit_desc"), callback_data: "nt:edit:desc" },
    ],
    [
      { text: t(lc, "btn_edit_prio"), callback_data: "nt:edit:prio" },
      { text: t(lc, "btn_edit_due"), callback_data: "nt:edit:due" },
    ],
    [
      { text: t(lc, "btn_edit_asgn"), callback_data: "nt:edit:asgn" },
      { text: t(lc, "btn_edit_rec"), callback_data: "nt:edit:rec" },
    ],
    [{ text: t(lc, "cancel"), callback_data: "nt:cancel" }],
  ];
}

// ---------- Task action keyboard ----------
export function taskActionsKb(lc: LC, taskId: number, status: string, watching: boolean): Btn[][] {
  const id = taskId;
  const statusRow: Btn[] = [];
  if (status !== "in_progress") statusRow.push({ text: t(lc, "btn_start"), callback_data: `t:start:${id}` });
  if (status === "in_progress") statusRow.push({ text: t(lc, "btn_block"), callback_data: `t:block:${id}` });
  if (status !== "in_review" && status !== "done") statusRow.push({ text: t(lc, "btn_review"), callback_data: `t:review:${id}` });
  if (status !== "done") statusRow.push({ text: t(lc, "btn_done"), callback_data: `t:done:${id}` });
  return [
    statusRow.length ? statusRow : [{ text: t(lc, "btn_reopen"), callback_data: `t:reopen:${id}` }],
    [
      { text: t(lc, "btn_reassign"), callback_data: `t:reassign:${id}` },
      { text: t(lc, "btn_resched"), callback_data: `t:resched:${id}` },
    ],
    [
      { text: t(lc, "btn_priority"), callback_data: `t:prio:${id}` },
      { text: t(lc, "btn_labels"), callback_data: `t:lbl:${id}` },
    ],
    [
      { text: t(lc, "btn_comment"), callback_data: `t:cmt:${id}` },
      { text: t(lc, "btn_subtask"), callback_data: `t:sub:${id}` },
    ],
    [
      { text: t(lc, "btn_snooze"), callback_data: `t:snz:${id}` },
      { text: watching ? t(lc, "btn_unwatch") : t(lc, "btn_watch"), callback_data: `t:${watching ? "unwatch" : "watch"}:${id}` },
    ],
    [
      { text: t(lc, "btn_timer_start"), callback_data: `t:wstart:${id}` },
      { text: t(lc, "btn_timer_stop"), callback_data: `t:wstop:${id}` },
    ],
    [
      { text: t(lc, "refresh"), callback_data: `t:view:${id}` },
      { text: t(lc, "btn_tcancel"), callback_data: `t:tcancel:${id}` },
    ],
  ];
}

export function priorityChooseKb(lc: LC, taskId: number): Btn[][] {
  return [
    [
      { text: "🔴 P0", callback_data: `t:setprio:${taskId}:p0` },
      { text: "🟠 P1", callback_data: `t:setprio:${taskId}:p1` },
      { text: "🟡 P2", callback_data: `t:setprio:${taskId}:p2` },
      { text: "🟢 P3", callback_data: `t:setprio:${taskId}:p3` },
    ],
    [{ text: t(lc, "btn_back"), callback_data: `t:view:${taskId}` }],
  ];
}

export function snoozeKb(lc: LC, taskId: number): Btn[][] {
  return [
    [
      { text: t(lc, "btn_in_1h"), callback_data: `t:setsnz:${taskId}:1h` },
      { text: t(lc, "btn_in_3h"), callback_data: `t:setsnz:${taskId}:3h` },
    ],
    [
      { text: t(lc, "btn_tom_9"), callback_data: `t:setsnz:${taskId}:tom9` },
      { text: t(lc, "btn_mon_9"), callback_data: `t:setsnz:${taskId}:mon9` },
    ],
    [{ text: t(lc, "btn_back"), callback_data: `t:view:${taskId}` }],
  ];
}

export function reschedKb(lc: LC, taskId: number): Btn[][] {
  return [
    [
      { text: t(lc, "btn_today"), callback_data: `t:setdue:${taskId}:today` },
      { text: t(lc, "btn_tomorrow"), callback_data: `t:setdue:${taskId}:tomorrow` },
    ],
    [
      { text: t(lc, "btn_in3d"), callback_data: `t:setdue:${taskId}:3d` },
      { text: t(lc, "btn_thisfri"), callback_data: `t:setdue:${taskId}:fri` },
    ],
    [
      { text: t(lc, "btn_nextmon"), callback_data: `t:setdue:${taskId}:nextmon` },
      { text: t(lc, "btn_clear_due"), callback_data: `t:setdue:${taskId}:none` },
    ],
    [{ text: t(lc, "btn_back"), callback_data: `t:view:${taskId}` }],
  ];
}

export function reassignKb(lc: LC, taskId: number, members: { id: number; name: string }[], page = 0): Btn[][] {
  const PER_PAGE = 6;
  const start = page * PER_PAGE;
  const slice = members.slice(start, start + PER_PAGE);
  const rows: Btn[][] = [];
  rows.push([{ text: t(lc, "btn_to_me"), callback_data: `t:setasgn:${taskId}:self` }]);
  for (const m of slice) rows.push([{ text: `👤 ${m.name}`, callback_data: `t:setasgn:${taskId}:${m.id}` }]);
  const nav: Btn[] = [];
  if (start > 0) nav.push({ text: t(lc, "btn_prev"), callback_data: `t:rapg:${taskId}:${page - 1}` });
  if (start + PER_PAGE < members.length) nav.push({ text: t(lc, "btn_next"), callback_data: `t:rapg:${taskId}:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: t(lc, "btn_back"), callback_data: `t:view:${taskId}` }]);
  return rows;
}

// ---------- Task list keyboard ----------
export function taskListKb(
  lc: LC,
  tasks: { id: number; title: string }[],
  filter: string,
  sort: string,
  page: number,
  hasNext: boolean
): Btn[][] {
  const rows: Btn[][] = [];

  rows.push([
    btnToggle(t(lc, "list_filter_all"), filter === "all", `lst:my:f:all`),
    btnToggle(t(lc, "list_filter_today"), filter === "today", `lst:my:f:today`),
    btnToggle(t(lc, "list_filter_overdue"), filter === "overdue", `lst:my:f:overdue`),
  ]);
  rows.push([
    btnToggle(t(lc, "list_filter_week"), filter === "week", `lst:my:f:week`),
    btnToggle(t(lc, "list_filter_done"), filter === "done", `lst:my:f:done`),
    btnToggle(t(lc, "list_filter_watching"), filter === "watching", `lst:my:f:watching`),
  ]);

  for (const tk of tasks) {
    const label = tk.title.length > 50 ? tk.title.slice(0, 47) + "…" : tk.title;
    rows.push([{ text: `#${tk.id} · ${label}`, callback_data: `t:view:${tk.id}` }]);
  }

  rows.push([
    btnToggle(t(lc, "list_sort_due"), sort === "due", `lst:my:s:due`),
    btnToggle(t(lc, "list_sort_prio"), sort === "prio", `lst:my:s:prio`),
    btnToggle(t(lc, "list_sort_new"), sort === "new", `lst:my:s:new`),
  ]);

  const nav: Btn[] = [];
  if (page > 0) nav.push({ text: t(lc, "btn_prev"), callback_data: `lst:my:p:${page - 1}` });
  nav.push({ text: `· ${page + 1} ·`, callback_data: "noop" });
  if (hasNext) nav.push({ text: t(lc, "btn_next"), callback_data: `lst:my:p:${page + 1}` });
  rows.push(nav);

  rows.push([
    { text: t(lc, "btn_new_task"), callback_data: "nt:new" },
    { text: t(lc, "refresh"), callback_data: `lst:my:p:${page}` },
  ]);
  return rows;
}

function btnToggle(text: string, active: boolean, cb: string): Btn {
  return { text: active ? `· ${text} ·` : text, callback_data: cb };
}

// ---------- Settings keyboard ----------
export function settingsKb(lc: LC): Btn[][] {
  return [
    [{ text: t(lc, "set_btn_lang"), callback_data: "set:menu:lang" }],
    [{ text: t(lc, "set_btn_notif"), callback_data: "set:menu:notif" }],
    [{ text: t(lc, "set_btn_quiet"), callback_data: "set:menu:quiet" }],
    [{ text: t(lc, "set_btn_tz"), callback_data: "set:menu:tz" }],
    [{ text: t(lc, "btn_close"), callback_data: "set:close" }],
  ];
}

export function languagePickerKb(lc: LC): Btn[][] {
  return [
    [
      { text: "🇮🇷 فارسی", callback_data: "lang:fa" },
      { text: "🇬🇧 English", callback_data: "lang:en" },
    ],
    [{ text: t(lc, "btn_back"), callback_data: "set:menu:root" }],
  ];
}

export function notifKb(lc: LC, prefs: { digestEnabled: boolean }): Btn[][] {
  return [
    [
      {
        text: `${prefs.digestEnabled ? "✅" : "⬜"} ${t(lc, "set_notif_digest")}`,
        callback_data: "set:notif:digest",
      },
    ],
    [{ text: t(lc, "btn_back"), callback_data: "set:menu:root" }],
  ];
}

export function quietHoursKb(lc: LC): Btn[][] {
  return [
    [
      { text: "🌙 22:00 → 08:00", callback_data: "set:quiet:22-08" },
      { text: "🌙 23:00 → 07:00", callback_data: "set:quiet:23-07" },
    ],
    [
      { text: "🌙 21:00 → 09:00", callback_data: "set:quiet:21-09" },
      { text: t(lc, "set_quiet_disable"), callback_data: "set:quiet:off" },
    ],
    [{ text: t(lc, "btn_back"), callback_data: "set:menu:root" }],
  ];
}

// ---------- Helpers ----------
export function navRow(ns: string, lc: LC, opts: { skip?: boolean; back?: boolean; cancel?: boolean } = {}): Btn[] {
  const r: Btn[] = [];
  if (opts.back) r.push({ text: t(lc, "back"), callback_data: `${ns}:back` });
  if (opts.skip) r.push({ text: t(lc, "skip"), callback_data: `${ns}:skip` });
  r.push({ text: t(lc, "cancel"), callback_data: `${ns}:cancel` });
  return r;
}
