import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const publicUrl = process.env.PUBLIC_URL!;
if (!token || !publicUrl) {
  console.error("Missing TELEGRAM_BOT_TOKEN or PUBLIC_URL");
  process.exit(1);
}

const url = `${publicUrl.replace(/\/$/, "")}/webapp/`;

const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    menu_button: {
      type: "web_app",
      text: "📊 Open KareOne",
      web_app: { url },
    },
  }),
});
console.log(res.status, await res.text());
console.log("Menu button → Mini App URL:", url);
