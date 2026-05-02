export type Dict = Record<string, string>;

const en: Dict = {
  welcome: "Welcome to KareOne, <b>{name}</b>!",
  not_member: "You're not part of any KareOne workspace yet. Ask your admin for an invite link.",
  bootstrap_done: "Workspace <b>{workspace}</b> is ready and you're the Super Admin.",
  bootstrap_already: "This workspace is already set up. Ignoring install token.",
  help_title: "<b>KareOne Bot — Commands</b>",
  help_body:
    "/newtask — create a task (interactive)\n" +
    "/mytasks — list tasks assigned to you\n" +
    "/today — tasks due today\n" +
    "/overdue — overdue tasks\n" +
    "/done &lt;id&gt; — mark a task done\n" +
    "/assign &lt;id&gt; @user — reassign a task\n" +
    "/ask @user &lt;question&gt; — ask a teammate\n" +
    "/whoami — show your profile\n" +
    "/lang — switch language (fa/en)\n" +
    "/invite — generate an invite link (admins)\n" +
    "/help — show this help",
  whoami: "<b>{name}</b> — role: <code>{role}</code> — workspace: <b>{workspace}</b>",
  unknown_command: "I didn't understand that. Try /help.",
  task_created: "✅ Task <b>#{id}</b> created: {title}",
  task_done: "✅ Task <b>#{id}</b> marked done.",
  task_not_found: "Task <b>#{id}</b> not found.",
  no_tasks: "You have no open tasks. ✨",
  task_line: "• <b>#{id}</b> {title} — <i>{status}</i>{due}",
  due_label: " · due {due}",
  permission_denied: "You don't have permission to do that.",
  invite_created: "Send this link to invite a teammate (expires in 24h):\n{link}",
  invalid_format: "Invalid format. Usage: {usage}",
  wizard_title: "What's the task title?",
  wizard_assignee: "Who should it be assigned to? Reply with @username or /skip.",
  wizard_due: "When is it due? e.g. <code>tomorrow 5pm</code>, <code>2026-05-10</code>, or /skip.",
  wizard_priority: "Priority? Reply p0/p1/p2/p3 or /skip.",
  wizard_cancelled: "Cancelled.",
  choose_lang: "Choose your language / زبان را انتخاب کنید:",
  lang_set_en: "✅ Language set to English.",
  lang_set_fa: "✅ زبان روی فارسی تنظیم شد.",
};

export default en;
