import type { Context } from "grammy";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

export async function handleHelp(ctx: Context) {
  const lc = await userLang(ctx.from!.id, ctx.from!.language_code);
  await ctx.reply(`${t(lc, "help_title")}\n\n${t(lc, "help_body")}`, { parse_mode: "HTML" });
}
