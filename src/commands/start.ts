import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { t } from "@/i18n";
import { upsertUser, displayName } from "@/lib/users";
import { audit } from "@/lib/audit";
import { h } from "@/lib/telegram";
import { userLang } from "@/lib/locale";
import { log } from "@/lib/logger";

export async function handleStart(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const { id: userId } = await upsertUser(tg);
  const lc = await userLang(tg.id, tg.language_code);
  const arg = args[0];

  // Bootstrap: first user with the install token becomes Super Admin
  if (arg && arg === env().INSTALL_TOKEN) {
    const existing = await db().select({ id: schema.workspaces.id }).from(schema.workspaces).limit(1);
    if (existing[0]) {
      await ctx.reply(t(lc, "bootstrap_already"), { parse_mode: "HTML" });
      return;
    }
    const [ws] = await db()
      .insert(schema.workspaces)
      .values({
        name: env().DEFAULT_WORKSPACE_NAME,
        timezone: env().DEFAULT_TIMEZONE,
        locale: env().DEFAULT_LOCALE,
      })
      .returning({ id: schema.workspaces.id, name: schema.workspaces.name });

    await db().insert(schema.memberships).values({
      workspaceId: ws!.id,
      userId,
      role: "super_admin",
    });

    await audit({ workspaceId: ws!.id, actorId: userId, action: "create", entity: "workspace", entityId: ws!.id });
    await ctx.reply(t(lc, "bootstrap_done", { workspace: h(ws!.name) }), { parse_mode: "HTML" });
    log.info("workspace bootstrapped", { workspaceId: ws!.id, userId });
    return;
  }

  // Invite token deep-link: /start invite_<token>
  if (arg?.startsWith("invite_")) {
    const token = arg.slice("invite_".length);
    const inv = await db()
      .select()
      .from(schema.inviteTokens)
      .where(eq(schema.inviteTokens.token, token))
      .limit(1);
    const row = inv[0];
    if (!row || row.usedBy || (row.expiresAt && row.expiresAt < new Date())) {
      await ctx.reply("This invite link is invalid or expired.");
      return;
    }
    await db().insert(schema.memberships).values({
      workspaceId: row.workspaceId,
      userId,
      role: row.role,
    }).onConflictDoNothing();
    await db()
      .update(schema.inviteTokens)
      .set({ usedBy: userId })
      .where(eq(schema.inviteTokens.token, token));
    await audit({ workspaceId: row.workspaceId, actorId: userId, action: "invite", entity: "membership" });
    await ctx.reply(t(lc, "welcome", { name: h(displayName(tg)) }), { parse_mode: "HTML" });
    return;
  }

  // Plain /start: greet + offer language picker
  await ctx.reply(
    `${t(lc, "welcome", { name: h(displayName(tg)) })}\n\n${t(lc, "choose_lang")}`,
    {
      parse_mode: "HTML",
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
}
