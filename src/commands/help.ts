import type { Context } from "grammy";
import { t } from "@/i18n";

export async function handleHelp(ctx: Context) {
  const lc = ctx.from?.language_code;
  await ctx.reply(`${t(lc, "help_title")}\n\n${t(lc, "help_body")}`, { parse_mode: "MarkdownV2" });
}
