import type { Context } from "grammy";
import type { InlineQueryResult } from "grammy/types";
import { and, eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";

/**
 * Inline mode: user types `@KareOnebot something` in any Telegram chat.
 * Returns up to 20 task results with #id and title; tapping inserts the task summary.
 */
export async function handleInlineQuery(ctx: Context) {
  const q = ctx.inlineQuery?.query?.trim() ?? "";
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await ctx.answerInlineQuery([], { cache_time: 5, is_personal: true });
    return;
  }
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const rows = await db()
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.workspaceId, m.workspaceId),
        q ? sql`(${schema.tasks.title} ILIKE ${like} OR COALESCE(${schema.tasks.description}, '') ILIKE ${like})` : sql`TRUE`
      )
    )
    .orderBy(desc(schema.tasks.updatedAt))
    .limit(20);

  const results: InlineQueryResult[] = rows.map((r) => ({
    type: "article",
    id: String(r.id),
    title: `#${r.id} · ${r.title}`,
    description: `${r.status} · ${r.priority.toUpperCase()}`,
    input_message_content: {
      message_text: `Task <b>#${r.id}</b> — ${escape(r.title)}\nStatus: ${r.status} · Priority: ${r.priority.toUpperCase()}`,
      parse_mode: "HTML",
    },
    reply_markup: {
      inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${r.id}` }]],
    },
  }));

  await ctx.answerInlineQuery(results, { cache_time: 5, is_personal: true });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
