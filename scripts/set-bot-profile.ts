import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN missing");
  process.exit(1);
}

const NAME = "KareOne";
const SHORT = "Tasks · Q&A · workflows for KareOne. کارها و پرسش‌ها";
const ABOUT_EN =
  "KareOne — task assignment, approvals, SLA tracking, and team Q&A.\n\n" +
  "• /newtask — visual 7-step task wizard\n" +
  "• /mytasks — your inbox with filters\n" +
  "• /ask, /answer, /kb — team knowledge\n" +
  "• /report, /sla, /approval — admin tools\n" +
  "• /lang — switch fa/en";

async function call(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(method, res.status, await res.text());
}

await call("setMyName", { name: NAME });
await call("setMyShortDescription", { short_description: SHORT });
await call("setMyDescription", { description: ABOUT_EN });
console.log("\nNote: profile photo cannot be set via Bot API.");
console.log("Open Telegram → @BotFather → /setuserpic → choose @KareOnebot → upload kareone-logo.png");
