export type Dict = Record<string, string>;

const en: Dict = {
  // ---------- Generic ----------
  welcome: "Welcome to KareOne, <b>{name}</b>!",
  not_member: "You're not part of any KareOne workspace yet. Ask your admin for an invite link.",
  bootstrap_done: "Workspace <b>{workspace}</b> is ready and you're the Super Admin.",
  bootstrap_already: "This workspace is already set up. Ignoring install token.",
  permission_denied: "You don't have permission to do that.",
  invalid_format: "Invalid format. Usage: {usage}",
  unknown_command: "I didn't understand that. Try /help.",
  cancelled: "Cancelled.",
  not_found: "Not found.",
  done: "Done.",
  back: "⬅️ Back",
  skip: "⏭️ Skip",
  cancel: "❌ Cancel",
  refresh: "🔄 Refresh",

  // ---------- Help ----------
  help_title: "<b>KareOne Bot — Commands</b>",
  help_body:
    "<b>📋 Tasks</b>\n" +
    "/newtask — interactive 7-step wizard\n" +
    "/mytasks — visual list with filters &amp; sort\n" +
    "/task &lt;id&gt; — open a task card\n" +
    "/find &lt;query&gt; — search tasks\n" +
    "/today /overdue — quick filters\n" +
    "/done &lt;id&gt; · /assign &lt;id&gt; @user\n" +
    "/history &lt;id&gt; — audit timeline\n" +
    "/export — CSV export\n\n" +
    "<b>🗂️ Projects</b>\n" +
    "/projects — list · /newproject — create\n\n" +
    "<b>⏱️ Time</b>\n" +
    "/work start|stop|status &lt;id&gt;\n\n" +
    "<b>❓ Q&amp;A · KB</b>\n" +
    "/ask @user &lt;question&gt; · /answer &lt;qid&gt; &lt;text&gt;\n" +
    "/questions · /kb &lt;query&gt;\n" +
    "/upvote &lt;answer_id&gt; · /official &lt;answer_id&gt;\n\n" +
    "<b>👥 Groups</b>\n" +
    "/standup — start a daily check-in (in groups)\n\n" +
    "<b>🛂 Approvals · SLA · Reports</b>\n" +
    "/approval &lt;task_id&gt; @user1 @user2 [all]\n" +
    "/sla — view/set SLA targets (admin)\n" +
    "/report — workspace + personal stats\n\n" +
    "<b>⚙️ You</b>\n" +
    "/settings · /whoami · /lang · /invite · /help\n\n" +
    "<i>Tip: Use the bot inline — type @KareOnebot in any chat to search tasks.</i>",
  whoami: "<b>{name}</b> — role: <code>{role}</code> — workspace: <b>{workspace}</b>",

  // ---------- Language ----------
  choose_lang: "Choose your language / زبان را انتخاب کنید:",
  lang_set_en: "✅ Language set to English.",
  lang_set_fa: "✅ زبان روی فارسی تنظیم شد.",

  // ---------- Old quick task ----------
  task_created: "✅ Task <b>#{id}</b> created: {title}",
  task_done: "✅ Task <b>#{id}</b> marked done.",
  task_not_found: "Task <b>#{id}</b> not found.",
  no_tasks: "You have no open tasks. ✨",
  task_line: "• <b>#{id}</b> {title} — <i>{status}</i>{due}",
  due_label: " · due {due}",
  invite_created: "Send this link to invite a teammate (expires in 24h):\n{link}",

  // ---------- Wizard ----------
  wizard_title_step: "📝 <b>Step 1 of 7 — Title</b>\nWhat is the task about? Send a short title.",
  wizard_desc_step: "📝 <b>Step 2 of 7 — Description</b>\nAdd details, or tap Skip.",
  wizard_priority_step: "⚡ <b>Step 3 of 7 — Priority</b>\nHow important is this task?",
  wizard_due_step: "📅 <b>Step 4 of 7 — Due date</b>\nWhen should this be done?",
  wizard_time_step: "🕐 <b>Step 4 of 7 — Time of day</b>\nPick a time on {date}.",
  wizard_assignee_step: "👤 <b>Step 5 of 7 — Assignee</b>\nWho will work on this?",
  wizard_project_step: "🗂️ <b>Step 6 of 7 — Project</b>\nWhich project?",
  wizard_recurrence_step: "🔁 <b>Step 6 of 7 — Recurrence</b>\nDoes this repeat?",
  wizard_review_step: "📋 <b>Step 7 of 7 — Review</b>",
  wizard_send_date: "Send the due date as <code>YYYY-MM-DD</code>:",
  wizard_send_time: "Send the time as <code>HH:MM</code>:",
  wizard_invalid_date: "Invalid date. Format: <code>YYYY-MM-DD</code> (e.g. 2026-05-15).",
  wizard_invalid_time: "Invalid time. Format: <code>HH:MM</code> (e.g. 17:30).",
  wizard_send_new_title: "Send a new title:",
  wizard_send_new_desc: "Send a new description (or tap Skip):",
  wizard_cancelled: "❌ Task creation cancelled.",
  wizard_expired: "Wizard expired. Send /newtask to start over.",
  wizard_field_title: "Title",
  wizard_field_desc: "Description",
  wizard_field_priority: "Priority",
  wizard_field_due: "Due",
  wizard_field_assignee: "Assignee",
  wizard_field_recurrence: "Recurrence",
  wizard_unassigned: "— Unassigned",

  // Wizard buttons
  btn_p0: "🔴 P0 — Urgent",
  btn_p1: "🟠 P1 — High",
  btn_p2: "🟡 P2 — Normal",
  btn_p3: "🟢 P3 — Low",
  btn_today: "📅 Today",
  btn_tomorrow: "📅 Tomorrow",
  btn_in3d: "📅 In 3 days",
  btn_thisfri: "📅 This Friday",
  btn_nextmon: "📅 Next Monday",
  btn_in2w: "📅 In 2 weeks",
  btn_custom_date: "✏️ Custom date",
  btn_no_due: "⏭️ No due date",
  btn_morning: "🌅 Morning (09:00)",
  btn_eod: "🌃 End of day (23:59)",
  btn_custom_time: "✏️ Custom time",
  btn_rec_none: "🚫 None (one-off)",
  btn_rec_daily: "📆 Daily",
  btn_rec_weekdays: "📅 Weekdays",
  btn_rec_weekly: "📅 Weekly",
  btn_rec_biweekly: "📅 Bi-weekly",
  btn_rec_monthly: "📅 Monthly",
  btn_assign_self: "🙋 Assign to me",
  btn_assign_none: "👥 Unassigned",
  btn_create: "✅ Create task",
  btn_edit_title: "✏️ Edit title",
  btn_edit_desc: "✏️ Edit desc",
  btn_edit_prio: "✏️ Priority",
  btn_edit_due: "✏️ Due",
  btn_edit_asgn: "✏️ Assignee",
  btn_edit_rec: "✏️ Recurrence",

  // ---------- Recurrence labels ----------
  rec_label_none: "None (one-off)",
  rec_label_daily: "Daily",
  rec_label_weekdays: "Weekdays (Sat–Thu)",
  rec_label_weekly: "Weekly",
  rec_label_biweekly: "Bi-weekly",
  rec_label_monthly: "Monthly",

  // ---------- Status / Priority labels ----------
  status_open: "📂 Open",
  status_assigned: "📌 Assigned",
  status_in_progress: "🔧 In progress",
  status_blocked: "🛑 Blocked",
  status_in_review: "👀 In review",
  status_done: "✅ Done",
  status_cancelled: "❌ Cancelled",
  status_rejected: "🚫 Rejected",
  status_archived: "🗄️ Archived",
  status_draft: "📝 Draft",

  // ---------- Task card ----------
  card_due_label: "📅 Due: {due}",
  card_unassigned: "Unassigned",
  card_subtasks_header: "<b>Subtasks ({n}):</b>",
  card_recent_comments: "<b>Recent comments:</b>",
  card_timer_running: "⏱️ Timer running · {min} min",
  card_recurrence: "🔁 Recurrence: <code>{rule}</code>",

  // Task action buttons
  btn_start: "▶️ Start",
  btn_block: "⏸️ Block",
  btn_review: "👀 Review",
  btn_done: "✅ Done",
  btn_reopen: "🔁 Reopen",
  btn_reassign: "👤 Reassign",
  btn_resched: "📅 Reschedule",
  btn_priority: "⚡ Priority",
  btn_labels: "🏷️ Labels",
  btn_comment: "💬 Comment",
  btn_subtask: "➕ Subtask",
  btn_snooze: "⏰ Snooze",
  btn_watch: "⭐ Star",
  btn_unwatch: "🌟 Unstar",
  btn_timer_start: "⏱️ Start timer",
  btn_timer_stop: "⏹️ Stop timer",
  btn_tcancel: "❌ Cancel task",
  btn_view_task: "👁️ View task",
  btn_open_task: "👁️ Open task",
  btn_my_tasks: "📋 My tasks",
  btn_new_task: "➕ New task",
  btn_to_me: "🙋 To me",
  btn_back: "⬅️ Back",
  btn_prev: "⬅️ Prev",
  btn_next: "Next ➡️",
  btn_close: "✖️ Close",
  btn_clear_due: "🚫 Clear due",
  btn_in_1h: "⏰ +1 hour",
  btn_in_3h: "⏰ +3 hours",
  btn_tom_9: "📅 Tomorrow 9am",
  btn_mon_9: "📅 Next Monday",
  btn_approve: "✅ Approve",
  btn_reject: "❌ Reject",

  // Task card prompts
  comment_prompt: "💬 Send your comment for task #{id} (or /cancel):",
  comment_added: "✅ Comment added.",
  subtask_prompt: "➕ Send the subtask title for #{id} (or /cancel):",
  subtask_created: "✅ Subtask <b>#{id}</b> created.",
  parent_not_found: "Parent task not found.",
  reassign_prompt: "👤 Reassign task #{id} to:",
  resched_prompt: "📅 Reschedule task #{id}:",
  priority_prompt: "⚡ Choose priority for task #{id}:",
  snooze_prompt: "⏰ Snooze task #{id} until:",
  reassigned_to: "✅ Reassigned task #{id} to {who}.",
  user_not_in_workspace: "User {who} is not in this workspace.",
  task_assigned_dm: "🆕 Task <b>#{id}</b> assigned to you.\n{title}",
  notify_status_change: "🔄 <b>#{id}</b> status → <i>{status}</i>",
  notify_new_comment: "💬 New comment on <b>#{id}</b>",
  no_timer: "No timer running.",
  timers_require_redis: "Timers require Redis.",
  closed: "Closed.",

  // ---------- Task list ----------
  list_header: "📋 <b>My tasks</b> · {filter} · sorted by {sort}",
  list_empty: "\n\n<i>No tasks match this filter.</i>",
  list_filter_all: "📥 All",
  list_filter_today: "📅 Today",
  list_filter_overdue: "🚨 Overdue",
  list_filter_week: "🗓️ Week",
  list_filter_done: "✅ Done",
  list_filter_watching: "⭐ Starred",
  list_sort_due: "⏰ Due",
  list_sort_prio: "⚡ Priority",
  list_sort_new: "🆕 Newest",
  list_filter_label_all: "All open",
  list_filter_label_today: "Today",
  list_filter_label_overdue: "Overdue",
  list_filter_label_week: "Next 7 days",
  list_filter_label_done: "Done",
  list_filter_label_watching: "Starred",
  list_sort_label_due: "due date",
  list_sort_label_prio: "priority",
  list_sort_label_new: "newest",

  // ---------- Settings ----------
  settings_title: "⚙️ <b>Settings</b>\nChoose a section:",
  set_btn_lang: "🌐 Language",
  set_btn_notif: "🔔 Notifications",
  set_btn_quiet: "🌙 Quiet hours",
  set_btn_tz: "🕒 Timezone",
  set_lang_title: "🌐 <b>Language</b>",
  set_notif_title: "🔔 <b>Notifications</b>\nToggle which alerts you receive:",
  set_notif_digest: "Daily digest",
  set_quiet_title: "🌙 <b>Quiet hours</b>\nWhen should I stop pinging you?",
  set_quiet_disable: "☀️ Disable",
  set_quiet_disabled: "✅ Quiet hours disabled.",
  set_quiet_set: "✅ Quiet hours: {start} → {end}",
  set_tz_admin_only: "🕒 Timezone is set workspace-wide. Ask an admin to change it.",
  set_notif_digest_state: "🔔 <b>Notifications</b>\nDaily digest: {state}",

  // ---------- Q&A ----------
  qa_send_answer: "💬 Send your answer to Q#{id} (or /cancel):",
  qa_q_not_found: "Q#{id} not found.",
  qa_answer_posted: "✅ Answer posted to Q#{id}.",
  qa_new_answer_dm: "💬 New answer on Q#{id} from <b>{who}</b>:\n{body}",
  qa_no_open: "No open questions. ✨",
  qa_question_sent: "📨 Question #{id} sent.",
  qa_question_dm: "❓ Question from <b>{who}</b> (Q#{id}):\n{body}",
  qa_upvoted: "👍 Answer #{id} upvoted (total: {n}).",
  qa_marked_official: "⭐ Answer #{id} marked as official.",
  qa_already_official: "Already marked official.",
  qa_answer_not_found: "Answer #{id} not found.",
  qa_use_answer: "Usage: /answer <question_id> <text>",
  qa_use_upvote: "Usage: /upvote <answer_id>",
  qa_use_official: "Usage: /official <answer_id>",
  qa_only_asker_can_official: "Only the question's asker can mark an official answer.",

  // ---------- KB ----------
  kb_no_results: "📚 No KB entries match <b>{q}</b>.",
  kb_results_header: "📚 <b>KB results for \"{q}\":</b>\n",
  kb_use: "Usage: /kb <query> — searches answered questions in your workspace.",

  // ---------- Approvals ----------
  ap_use:
    "Usage: <code>/approval &lt;task_id&gt; @user1 @user2 ... [all]</code>\n" +
    "<i>Default is 'any' (any one approver suffices). Add the word 'all' to require everyone.</i>",
  ap_no_approvers: "None of the listed users are in this workspace.",
  ap_dm:
    "🛂 <b>Approval requested</b>\nTask <b>#{id}</b> · {title}\nRequested by <b>{who}</b>",
  ap_started:
    "✅ Approval requested on <b>#{id}</b>.\nMode: <b>{mode}</b>\nApprovers notified: {n}",
  ap_mode_all: "All approvers required",
  ap_mode_any: "Any one approver",
  ap_send_reason: "✏️ Send a short reason for rejection (or /skip):",
  ap_not_yours: "This approval is not yours.",
  ap_already_decided: "You already {decision} this.",
  ap_recorded: "Recorded: <b>{decision}</b>",
  ap_recorded_with_reason: "Recorded: <b>{decision}</b>\nReason: {reason}",
  ap_resolved_dm: "{emoji} Approval on <b>#{id}</b> resolved: <b>{status}</b>",

  // ---------- SLA ----------
  sla_header: "⏱️ <b>SLA policies</b> (response → resolution)",
  sla_defaults_header: "⏱️ <b>Default SLA targets</b>",
  sla_change_hint:
    "To change: <code>/sla set &lt;p0|p1|p2|p3&gt; &lt;response_min&gt; &lt;resolution_min&gt;</code>\nDefaults are restored if you delete a row.",
  sla_set: "✅ {priority} SLA → response {resp}, resolution {reso}.",
  sla_warn:
    "⚠️ <b>SLA warning</b>\nTask <b>#{id}</b> · {title}\n80% of SLA window consumed.",
  sla_breach:
    "🚨 <b>SLA BREACHED</b>\nTask <b>#{id}</b> · {title}\nResolution window exceeded.",
  sla_use: "Usage: /sla [show|defaults|set <p> <resp> <reso>]",
  sla_admin_only: "Admins only.",

  // ---------- Report ----------
  report_title: "📊 <b>Workspace report</b>",
  report_status: "<b>Tasks by status</b> (total {total})",
  report_priority: "<b>Tasks by priority</b>",
  report_you: "<b>You</b>",
  report_open: "📥 Open: {n}",
  report_done_week: "✅ Done in last 7 days: {n}",
  report_overdue: "🚨 Overdue: {n}",
  report_logged: "⏱️ Total logged time: {h}h {m}m",

  // ---------- Find / search ----------
  find_use: "Usage: /find <query>",
  find_no_results: "No tasks match <b>{q}</b>.",
  find_results_header: "🔎 <b>Results for \"{q}\":</b>",

  // ---------- Projects ----------
  proj_use_create: "Usage: /newproject <name>",
  proj_created: "🗂️ Project <b>#{id}</b> — {name} — created.",
  proj_none: "No projects yet. Create one with /newproject <name>.",
  proj_list_header: "🗂️ <b>Projects</b>",
  proj_btn_no_project: "🚫 No project",

  // ---------- Time tracking ----------
  work_use: "Usage: /work start <task_id> · /work stop <task_id> · /work status",
  work_no_timers: "No timers running.",
  work_status_line: "⏱️ #{id} — running {m} min",
  work_started: "▶️ Timer started on task #{id}.",
  work_no_timer_on: "No timer running on #{id}.",
  work_stopped: "⏹️ Timer stopped. Logged <b>{m} min</b> on #{id}.",

  // ---------- Export ----------
  export_empty: "No tasks to export.",
  export_caption: "📁 Your tasks ({n}) — CSV",

  // ---------- History ----------
  history_use: "Usage: /history <task_id>",
  history_header: "📜 <b>History of #{id}</b>",
  history_empty: "No audit entries for this task yet.",

  // ---------- Standup / groups ----------
  standup_only_in_groups: "Run /standup inside a team group chat (not in a private chat).",
  standup_started:
    "📣 <b>Daily standup</b>\nReply with: 1) Yesterday 2) Today 3) Blockers.",
  standup_logged: "✅ Standup recorded.",
};

export default en;
