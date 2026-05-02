import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

let cached: Redis | null = null;

export function redis(): Redis | null {
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!cached) {
    cached = new Redis({
      url: e.UPSTASH_REDIS_REST_URL,
      token: e.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return cached;
}

/** Idempotency: returns true if this updateId has not been processed before. */
export async function claimUpdate(updateId: number, ttlSec = 300): Promise<boolean> {
  const r = redis();
  if (!r) return true; // best-effort if Redis is not configured
  const key = `tg:update:${updateId}`;
  const set = await r.set(key, 1, { nx: true, ex: ttlSec });
  return set === "OK";
}

/** Wizard / conversation state per (chatId, userId). */
export async function getState<T = unknown>(chatId: number, userId: number): Promise<T | null> {
  const r = redis();
  if (!r) return null;
  return (await r.get<T>(`tg:state:${chatId}:${userId}`)) ?? null;
}

export async function setState<T>(chatId: number, userId: number, state: T, ttlSec = 900) {
  const r = redis();
  if (!r) return;
  await r.set(`tg:state:${chatId}:${userId}`, state, { ex: ttlSec });
}

export async function clearState(chatId: number, userId: number) {
  const r = redis();
  if (!r) return;
  await r.del(`tg:state:${chatId}:${userId}`);
}
