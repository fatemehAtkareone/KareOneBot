import "dotenv/config";
const token = process.env.TELEGRAM_BOT_TOKEN!;
const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
console.log(res.status, await res.text());
