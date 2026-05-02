import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { md } from "@/lib/telegram";
import { displayName } from "@/lib/users";

export async function handleWhoami(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.reply(t(tg.language_code, "not_member"));
    return;
  }
  const ws = await db()
    .select({ name: schema.workspaces.name })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, m.workspaceId))
    .limit(1);

  await ctx.reply(
    t(tg.language_code, "whoami", {
      name: md(displayName(tg)),
      role: m.role,
      workspace: md(ws[0]?.name ?? ""),
    }),
    { parse_mode: "MarkdownV2" }
  );
}
