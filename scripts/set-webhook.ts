import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET!;
const publicUrl = process.env.PUBLIC_URL!;

if (!token || !secret || !publicUrl) {
  console.error("Missing TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, or PUBLIC_URL");
  process.exit(1);
}

const url = `${publicUrl.replace(/\/$/, "")}/.netlify/functions/telegram-webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "callback_query", "inline_query"],
    drop_pending_updates: true,
  }),
});
console.log(res.status, await res.text());
