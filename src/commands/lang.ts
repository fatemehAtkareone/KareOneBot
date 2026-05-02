import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { upsertUser } from "@/lib/users";

export async function handleLang(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const choice = (args[0] ?? "").toLowerCase();

  if (choice !== "fa" && choice !== "en") {
    await ctx.reply(
      "Choose your language / زبان را انتخاب کنید:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🇮🇷 فارسی", callback_data: "lang:fa" },
              { text: "🇬🇧 English", callback_data: "lang:en" },
            ],
          ],
        },
      }
    );
    return;
  }

  await setLang(tg.id, choice);
  await ctx.reply(choice === "fa" ? "✅ زبان روی فارسی تنظیم شد." : "✅ Language set to English.");
}

export async function handleLangCallback(ctx: Context, choice: "fa" | "en") {
  const tg = ctx.from!;
  await upsertUser(tg);
  await setLang(tg.id, choice);
  await ctx.answerCallbackQuery({ text: choice === "fa" ? "زبان: فارسی" : "Language: English" });
  await ctx.reply(choice === "fa" ? "✅ زبان روی فارسی تنظیم شد." : "✅ Language set to English.");
}

async function setLang(telegramId: number, lang: "fa" | "en") {
  await db().update(schema.users).set({ languageCode: lang }).where(eq(schema.users.telegramId, telegramId));
}
