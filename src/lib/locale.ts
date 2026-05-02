import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const cache = new Map<number, { lang: string; at: number }>();
const TTL_MS = 60_000;

/**
 * Resolve the effective language for a Telegram user.
 * Priority: stored preference (`users.language_code` set via /lang) → Telegram client `language_code` → "fa".
 */
export async function userLang(telegramId: number, fallbackTgLang?: string): Promise<string> {
  const hit = cache.get(telegramId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lang;

  try {
    const rows = await db()
      .select({ lc: schema.users.languageCode })
      .from(schema.users)
      .where(eq(schema.users.telegramId, telegramId))
      .limit(1);
    const stored = rows[0]?.lc;
    const lang = (stored === "fa" || stored === "en") ? stored : (fallbackTgLang === "fa" ? "fa" : fallbackTgLang === "en" ? "en" : "fa");
    cache.set(telegramId, { lang, at: Date.now() });
    return lang;
  } catch {
    return fallbackTgLang === "en" ? "en" : "fa";
  }
}

export function invalidateLang(telegramId: number) {
  cache.delete(telegramId);
}
