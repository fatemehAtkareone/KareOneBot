import type { Context } from "grammy";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sql } from "drizzle-orm";

export async function handleDiag(ctx: Context) {
  const lines: string[] = [];
  lines.push(`Node: ${process.version}`);
  lines.push(`Has DATABASE_URL: ${!!process.env.DATABASE_URL}`);
  lines.push(`Has TELEGRAM_BOT_TOKEN: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
  lines.push(`Has UPSTASH_REDIS_REST_URL: ${!!process.env.UPSTASH_REDIS_REST_URL}`);

  // DB ping
  try {
    const r = await db().execute(sql`SELECT 1 AS ok`);
    lines.push(`DB ping: OK (${JSON.stringify(r[0] ?? {})})`);
  } catch (e) {
    lines.push(`DB ping FAIL: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Redis ping
  try {
    const r = redis();
    if (!r) {
      lines.push(`Redis: NOT CONFIGURED`);
    } else {
      const pong = await r.ping();
      lines.push(`Redis ping: ${pong}`);
    }
  } catch (e) {
    lines.push(`Redis FAIL: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Table count
  try {
    const r = await db().execute(
      sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
    );
    lines.push(`Public tables: ${(r[0] as { n: number } | undefined)?.n ?? "?"}`);
  } catch (e) {
    lines.push(`Table count FAIL: ${e instanceof Error ? e.message : String(e)}`);
  }

  await ctx.reply(`<pre>${lines.join("\n")}</pre>`, { parse_mode: "HTML" });
}
