import type { Context } from "grammy";
import { and, eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import { h } from "@/lib/telegram";

export async function handleFind(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));
  const q = args.join(" ").trim();
  if (!q) return void ctx.reply(t(lc, "find_use"));

  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db()
    .select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.workspaceId, m.workspaceId),
        sql`(${schema.tasks.title} ILIKE ${like} OR COALESCE(${schema.tasks.description}, '') ILIKE ${like})`
      )
    )
    .orderBy(desc(schema.tasks.updatedAt))
    .limit(15);

  if (rows.length === 0) {
    await ctx.reply(t(lc, "find_no_results", { q: h(q) }), { parse_mode: "HTML" });
    return;
  }

  const buttons = rows.map((r) => [{
    text: `#${r.id} · ${(r.title ?? "").slice(0, 50)}`,
    callback_data: `t:view:${r.id}`,
  }]);
  await ctx.reply(t(lc, "find_results_header", { q: h(q) }), {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}
