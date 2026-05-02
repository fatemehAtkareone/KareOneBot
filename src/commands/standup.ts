import type { Context } from "grammy";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import { chatScope } from "@/lib/chat";

export async function handleStandup(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const scope = chatScope(ctx);
  if (!scope.isGroup) {
    await ctx.reply(t(lc, "standup_only_in_groups"));
    return;
  }
  const sent = await ctx.reply(t(lc, "standup_started"), { parse_mode: "HTML" });
  // Best-effort pin
  try {
    await ctx.api.pinChatMessage(ctx.chat!.id, sent.message_id, { disable_notification: true });
  } catch { /* ignored — bot may lack pin permission */ }
}
