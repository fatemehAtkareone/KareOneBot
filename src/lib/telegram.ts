import { Bot } from "grammy";
import { env } from "@/lib/env";

let cached: Bot | null = null;

export function bot(): Bot {
  if (!cached) {
    cached = new Bot(env().TELEGRAM_BOT_TOKEN);
  }
  return cached;
}

/** Escape text for MarkdownV2. */
export function md(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/** Send a plain message bypassing the grammy middleware stack (useful in scheduled jobs). */
export async function sendMessage(chatId: number, text: string, opts?: Record<string, unknown>) {
  return bot().api.sendMessage(chatId, text, { parse_mode: "MarkdownV2", ...opts });
}
