import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN!;

const commands = [
  { command: "start", description: "Start / register" },
  { command: "help", description: "Show all commands" },
  { command: "newtask", description: "Create a task (wizard)" },
  { command: "mytasks", description: "Tasks assigned to me" },
  { command: "today", description: "Tasks due today" },
  { command: "overdue", description: "Overdue tasks" },
  { command: "done", description: "/done <id> — mark done" },
  { command: "assign", description: "/assign <id> @user — reassign" },
  { command: "ask", description: "/ask @user <question>" },
  { command: "invite", description: "Generate an invite link (admins)" },
  { command: "whoami", description: "Show your profile" },
  { command: "cancel", description: "Cancel current wizard" },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commands }),
});
console.log(res.status, await res.text());
