import { Bot } from "grammy";
import { env } from "@/lib/env";

let cached: Bot | null = null;

export function bot(): Bot {
  if (!cached) {
    cached = new Bot(env().TELEGRAM_BOT_TOKEN);
  }
  return cached;
}

/** Escape user-provided text for HTML parse mode (only <, >, & matter). */
export function h(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Send a plain HTML message bypassing the grammy middleware stack. */
export async function sendMessage(chatId: number, text: string, opts?: Record<string, unknown>) {
  return bot().api.sendMessage(chatId, text, { parse_mode: "HTML", ...opts });
}
