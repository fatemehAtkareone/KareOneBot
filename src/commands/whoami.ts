import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { h } from "@/lib/telegram";
import { displayName } from "@/lib/users";
import { userLang } from "@/lib/locale";

export async function handleWhoami(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.reply(t(lc, "not_member"));
    return;
  }
  const ws = await db()
    .select({ name: schema.workspaces.name })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, m.workspaceId))
    .limit(1);

  await ctx.reply(
    t(lc, "whoami", {
      name: h(displayName(tg)),
      role: m.role,
      workspace: h(ws[0]?.name ?? ""),
    }),
    { parse_mode: "HTML" }
  );
}
