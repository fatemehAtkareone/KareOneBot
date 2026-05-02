import "dotenv/config";
const token = process.env.TELEGRAM_BOT_TOKEN!;
const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
console.log(JSON.stringify(await res.json(), null, 2));
