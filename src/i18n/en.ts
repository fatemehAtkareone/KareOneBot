export type Dict = Record<string, string>;

const en: Dict = {
  welcome: "Welcome to KareOne, {name}!",
  not_member: "You're not part of any KareOne workspace yet. Ask your admin for an invite link.",
  bootstrap_done: "Workspace *{workspace}* is ready and you're the Super Admin.",
  bootstrap_already: "This workspace is already set up. Ignoring install token.",
  help_title: "*KareOne Bot — Commands*",
  help_body:
    "/newtask — create a task (interactive)\n" +
    "/mytasks — list tasks assigned to you\n" +
    "/today — tasks due today\n" +
    "/overdue — overdue tasks\n" +
    "/done <id> — mark a task done\n" +
    "/assign <id> @user — reassign a task\n" +
    "/ask @user <question> — ask a teammate a question\n" +
    "/whoami — show your profile\n" +
    "/invite — generate an invite link (admins only)\n" +
    "/help — show this help",
  whoami: "*{name}* — role: `{role}` — workspace: *{workspace}*",
  unknown_command: "I didn't understand that. Try /help.",
  task_created: "✅ Task *#{id}* created: {title}",
  task_done: "✅ Task *#{id}* marked done.",
  task_not_found: "Task *#{id}* not found.",
  no_tasks: "You have no open tasks. ✨",
  task_line: "• *#{id}* {title} — _{status}_{due}",
  due_label: " · due {due}",
  permission_denied: "You don't have permission to do that.",
  invite_created: "Send this link to invite a teammate (expires in 24h):\n{link}",
  invalid_format: "Invalid format. Usage: {usage}",
  wizard_title: "What's the task title?",
  wizard_assignee: "Who should it be assigned to? Reply with @username or /skip.",
  wizard_due: "When is it due? e.g. `tomorrow 5pm`, `2026-05-10`, or /skip.",
  wizard_priority: "Priority? Reply p0/p1/p2/p3 or /skip.",
  wizard_cancelled: "Cancelled.",
};

export default en;
