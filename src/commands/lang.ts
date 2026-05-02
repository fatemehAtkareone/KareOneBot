import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { upsertUser } from "@/lib/users";
import { invalidateLang } from "@/lib/locale";
import { t } from "@/i18n";

export async function handleLang(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const choice = (args[0] ?? "").toLowerCase();

  if (choice !== "fa" && choice !== "en") {
    await ctx.reply(t("fa", "choose_lang"), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇮🇷 فارسی", callback_data: "lang:fa" },
            { text: "🇬🇧 English", callback_data: "lang:en" },
          ],
        ],
      },
    });
    return;
  }

  await setLang(tg.id, choice);
  invalidateLang(tg.id);
  await ctx.reply(t(choice, choice === "fa" ? "lang_set_fa" : "lang_set_en"));
}

export async function handleLangCallback(ctx: Context, choice: "fa" | "en") {
  const tg = ctx.from!;
  await upsertUser(tg);
  await setLang(tg.id, choice);
  invalidateLang(tg.id);
  await ctx.answerCallbackQuery({ text: choice === "fa" ? "زبان: فارسی" : "Language: English" });
  await ctx.reply(t(choice, choice === "fa" ? "lang_set_fa" : "lang_set_en"));
}

async function setLang(telegramId: number, lang: "fa" | "en") {
  await db().update(schema.users).set({ languageCode: lang }).where(eq(schema.users.telegramId, telegramId));
}
