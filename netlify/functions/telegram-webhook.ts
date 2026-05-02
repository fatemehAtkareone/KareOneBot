import type { Handler } from "@netlify/functions";
import type { Update } from "grammy/types";
import { bot } from "@/lib/telegram";
import { route } from "@/commands/router";
import { claimUpdate } from "@/lib/redis";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  bot().use(async (ctx) => {
    try {
      await route(ctx);
    } catch (e) {
      const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      log.error("router error", { err, stack: e instanceof Error ? e.stack : undefined });
      try {
        await ctx.reply(`⚠️ Error: ${err.slice(0, 350)}`);
      } catch {}
    }
  });
  try {
    await bot().init();
  } catch (e) {
    log.error("bot.init failed", { err: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  initialized = true;
}

export const handler: Handler = async (event) => {
  // 1) Validate Telegram secret header
  const secret = event.headers["x-telegram-bot-api-secret-token"] ?? event.headers["X-Telegram-Bot-Api-Secret-Token"];
  if (secret !== env().TELEGRAM_WEBHOOK_SECRET) {
    log.warn("invalid webhook secret");
    return { statusCode: 401, body: "unauthorized" };
  }

  if (!event.body) return { statusCode: 200, body: "no body" };

  let update: Update;
  try {
    update = JSON.parse(event.body) as Update;
  } catch {
    return { statusCode: 400, body: "invalid json" };
  }

  // 2) Idempotency — Telegram retries on non-2xx
  const updateId = update.update_id;
  if (typeof updateId === "number") {
    const fresh = await claimUpdate(updateId);
    if (!fresh) {
      log.debug("duplicate update ignored", { updateId });
      return { statusCode: 200, body: "ok" };
    }
  }

  await ensureInit();

  try {
    await bot().handleUpdate(update);
  } catch (e) {
    log.error("handleUpdate failed", { err: String(e), updateId });
    // Still return 200 so Telegram doesn't redeliver indefinitely
  }

  return { statusCode: 200, body: "ok" };
};
