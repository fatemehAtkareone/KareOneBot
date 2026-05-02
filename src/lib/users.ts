import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/** Insert-or-fetch a user row by telegram_id. */
export async function upsertUser(tg: TgUser): Promise<{ id: number }> {
  const existing = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.telegramId, tg.id))
    .limit(1);

  if (existing[0]) {
    await db()
      .update(schema.users)
      .set({
        telegramUsername: tg.username ?? null,
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        languageCode: tg.language_code ?? null,
      })
      .where(eq(schema.users.id, existing[0].id));
    return { id: existing[0].id };
  }

  const inserted = await db()
    .insert(schema.users)
    .values({
      telegramId: tg.id,
      telegramUsername: tg.username ?? null,
      firstName: tg.first_name ?? null,
      lastName: tg.last_name ?? null,
      languageCode: tg.language_code ?? null,
    })
    .returning({ id: schema.users.id });

  return { id: inserted[0]!.id };
}

export function displayName(
  tg: TgUser | { firstName?: string | null; lastName?: string | null; telegramUsername?: string | null }
): string {
  const obj = tg as Record<string, string | undefined | null>;
  const f = obj.first_name ?? obj.firstName;
  const l = obj.last_name ?? obj.lastName;
  const u = obj.username ?? obj.telegramUsername;
  return [f, l].filter(Boolean).join(" ") || (u ? `@${u}` : "user");
}
