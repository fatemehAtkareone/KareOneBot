import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Membership } from "@/lib/rbac";

export interface TgWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Verify Telegram WebApp initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string): TgWebAppUser | null {
  if (!initData) return null;
  const url = new URLSearchParams(initData);
  const hash = url.get("hash");
  if (!hash) return null;
  url.delete("hash");

  // Build the data-check-string (sorted alphabetically by key)
  const pairs: string[] = [];
  for (const [k, v] of [...url.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    pairs.push(`${k}=${v}`);
  }
  const dataCheckString = pairs.join("\n");

  // secret = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return null;

  const authDate = Number(url.get("auth_date") ?? "0");
  // Reject very old initData (> 24h)
  if (!authDate || Date.now() / 1000 - authDate > 24 * 60 * 60) return null;

  const userJson = url.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as TgWebAppUser;
  } catch {
    return null;
  }
}

export interface AuthedSession {
  tgUser: TgWebAppUser;
  membership: Membership;
}

/** Verify the request and resolve the workspace membership for the calling user. */
export async function authenticate(initData: string): Promise<AuthedSession | null> {
  const tgUser = verifyInitData(initData, env().TELEGRAM_BOT_TOKEN);
  if (!tgUser) return null;

  // Resolve membership; do NOT auto-create — webapp users must already be registered via the bot
  const rows = await db()
    .select({
      membershipId: schema.memberships.id,
      workspaceId: schema.memberships.workspaceId,
      userId: schema.users.id,
      role: schema.memberships.role,
      active: schema.memberships.active,
    })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.users.telegramId, tgUser.id))
    .limit(1);

  const m = rows[0];
  if (!m || !m.active) return null;
  return { tgUser, membership: m };
}
