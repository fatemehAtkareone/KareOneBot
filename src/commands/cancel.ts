import type { Context } from "grammy";
import { clearState } from "@/lib/redis";
import { t } from "@/i18n";

export async function handleCancel(ctx: Context) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId && userId) await clearState(chatId, userId);
  await ctx.reply(t(ctx.from?.language_code, "wizard_cancelled"));
}
