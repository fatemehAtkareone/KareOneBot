import type { Context } from "grammy";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId, hasRole } from "@/lib/rbac";
import { env } from "@/lib/env";
import { t } from "@/i18n";
import { audit } from "@/lib/audit";
import { userLang } from "@/lib/locale";

export async function handleInvite(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));
  if (!hasRole(m.role, "admin")) return void ctx.reply(t(lc, "permission_denied"));

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db().insert(schema.inviteTokens).values({
    token,
    workspaceId: m.workspaceId,
    role: "member",
    createdBy: m.userId,
    expiresAt,
  });

  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "invite", entity: "invite_token" });

  const link = `https://t.me/${env().TELEGRAM_BOT_USERNAME}?start=invite_${token}`;
  await ctx.reply(t(lc, "invite_created", { link }));
}
