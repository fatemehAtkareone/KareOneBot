import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Membership } from "@/lib/rbac";
import { upsertUser } from "@/lib/users";

export interface TgWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type AuthFailure =
  | { ok: false; reason: "missing_initdata" }
  | { ok: false; reason: "bad_hmac" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "no_user" }
  | { ok: false; reason: "no_membership"; tgUserId: number; userId: number }
  | { ok: false; reason: "inactive_membership"; tgUserId: number; userId: number };

export interface AuthSuccess {
  ok: true;
  tgUser: TgWebAppUser;
  membership: Membership;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verify Telegram WebApp initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string): { user: TgWebAppUser | null; reason?: "bad_hmac" | "expired" | "missing" } {
  if (!initData) return { user: null, reason: "missing" };
  const url = new URLSearchParams(initData);
  const hash = url.get("hash");
  if (!hash) return { user: null, reason: "bad_hmac" };
  url.delete("hash");

  const pairs: string[] = [];
  for (const [k, v] of [...url.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    pairs.push(`${k}=${v}`);
  }
  const dataCheckString = pairs.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return { user: null, reason: "bad_hmac" };

  const authDate = Number(url.get("auth_date") ?? "0");
  if (!authDate || Date.now() / 1000 - authDate > 24 * 60 * 60) return { user: null, reason: "expired" };

  const userJson = url.get("user");
  if (!userJson) return { user: null, reason: "bad_hmac" };
  try {
    return { user: JSON.parse(userJson) as TgWebAppUser };
  } catch {
    return { user: null, reason: "bad_hmac" };
  }
}

/**
 * Authenticate a Mini App request. Self-heals by creating the `users` row
 * from initData if the HMAC is valid but no row exists yet (this can happen
 * when an invited user opens the Mini App before sending any bot message).
 *
 * Returns a discriminated union so callers can give the user a precise
 * error rather than a flat 401.
 */
export async function authenticate(initData: string): Promise<AuthResult> {
  const { user: tgUser, reason } = verifyInitData(initData, env().TELEGRAM_BOT_TOKEN);
  if (!tgUser) {
    if (reason === "missing") return { ok: false, reason: "missing_initdata" };
    if (reason === "expired") return { ok: false, reason: "expired" };
    return { ok: false, reason: "bad_hmac" };
  }

  // Ensure a users row exists. Mirrors what the bot does on every update.
  const { id: dbUserId } = await upsertUser({
    id: tgUser.id,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name,
    username: tgUser.username,
    language_code: tgUser.language_code,
  });

  // Fetch membership scoped to this user.
  const rows = await db()
    .select({
      membershipId: schema.memberships.id,
      workspaceId: schema.memberships.workspaceId,
      userId: schema.users.id,
      role: schema.memberships.role,
      active: schema.memberships.active,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.users.telegramId, tgUser.id))
    .limit(1);

  const m = rows[0];
  if (!m) return { ok: false, reason: "no_membership", tgUserId: tgUser.id, userId: dbUserId };
  if (!m.active) return { ok: false, reason: "inactive_membership", tgUserId: tgUser.id, userId: dbUserId };
  return { ok: true, tgUser, membership: m };
}
