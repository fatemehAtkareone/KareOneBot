import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN!;

const commands = [
  { command: "start", description: "Start / register · شروع" },
  { command: "help", description: "Show all commands · راهنما" },
  { command: "newtask", description: "Create a task · وظیفه جدید" },
  { command: "mytasks", description: "Tasks assigned to me · وظایف من" },
  { command: "today", description: "Tasks due today · وظایف امروز" },
  { command: "overdue", description: "Overdue tasks · وظایف عقب‌افتاده" },
  { command: "done", description: "/done <id> — mark done" },
  { command: "assign", description: "/assign <id> @user — reassign" },
  { command: "ask", description: "/ask @user <question>" },
  { command: "invite", description: "Invite link (admins) · دعوت" },
  { command: "whoami", description: "Profile · پروفایل" },
  { command: "lang", description: "Switch language · تغییر زبان" },
  { command: "diag", description: "Diagnostics · تشخیص" },
  { command: "cancel", description: "Cancel wizard · لغو" },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commands }),
});
console.log(res.status, await res.text());
