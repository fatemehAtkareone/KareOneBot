import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN!;

const commands = [
  { command: "start", description: "Start · شروع" },
  { command: "newtask", description: "📝 New task wizard · وظیفه جدید" },
  { command: "mytasks", description: "📋 My tasks (visual) · وظایف من" },
  { command: "task", description: "👁️ Open a task by id · باز کردن وظیفه" },
  { command: "today", description: "📅 Today · امروز" },
  { command: "overdue", description: "🚨 Overdue · عقب‌افتاده" },
  { command: "done", description: "✅ /done <id> — quick done" },
  { command: "assign", description: "👤 /assign <id> @user" },
  { command: "work", description: "⏱️ /work start|stop|status <id>" },
  { command: "ask", description: "❓ /ask @user <question>" },
  { command: "answer", description: "💬 /answer <qid> <text>" },
  { command: "questions", description: "📨 Open questions · پرسش‌ها" },
  { command: "kb", description: "📚 /kb <query> — search KB" },
  { command: "settings", description: "⚙️ Preferences · تنظیمات" },
  { command: "approval", description: "🛂 Request approval · درخواست تأیید" },
  { command: "sla", description: "⏱️ SLA targets (admin) · SLA" },
  { command: "report", description: "📊 Workspace report · گزارش" },
  { command: "lang", description: "🌐 Switch language · زبان" },
  { command: "invite", description: "🔗 Invite link (admins) · دعوت" },
  { command: "whoami", description: "🪪 Profile · پروفایل" },
  { command: "help", description: "❔ Help · راهنما" },
  { command: "diag", description: "🩺 Diagnostics" },
  { command: "cancel", description: "✖️ Cancel current wizard" },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commands }),
});
console.log(res.status, await res.text());
