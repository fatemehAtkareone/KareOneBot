import type { Context } from "grammy";
import { clearState } from "@/lib/redis";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

export async function handleCancel(ctx: Context) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId && userId) await clearState(chatId, userId);
  const lc = await userLang(userId ?? 0, ctx.from?.language_code);
  await ctx.reply(t(lc, "cancelled"));
}
