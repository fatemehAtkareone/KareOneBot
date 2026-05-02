import type { Context } from "grammy";
import { and, eq, sql, isNotNull, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { h } from "@/lib/telegram";

/** /kb <query> — naive ILIKE search across questions + answers in this workspace. */
export async function handleKb(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");
  const q = args.join(" ").trim();
  if (!q) {
    await ctx.reply("Usage: /kb <query> — searches answered questions in your workspace.");
    return;
  }
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const rows = await db()
    .select({
      qid: schema.questions.id,
      qbody: schema.questions.body,
      abody: schema.answers.body,
      isOfficial: schema.answers.isOfficial,
      upvotes: schema.answers.upvotes,
    })
    .from(schema.questions)
    .innerJoin(schema.answers, eq(schema.answers.questionId, schema.questions.id))
    .where(
      and(
        eq(schema.questions.workspaceId, m.workspaceId),
        sql`(${schema.questions.body} ILIKE ${like} OR ${schema.answers.body} ILIKE ${like})`,
        isNotNull(schema.answers.id)
      )
    )
    .orderBy(desc(schema.answers.isOfficial), desc(schema.answers.upvotes))
    .limit(8);

  if (rows.length === 0) {
    await ctx.reply(`📚 No KB entries match <b>${h(q)}</b>.`, { parse_mode: "HTML" });
    return;
  }

  const lines = rows.map((r) => {
    const badge = r.isOfficial ? "⭐" : "💡";
    return `${badge} <b>Q#${r.qid}</b> · ${h(r.qbody.slice(0, 100))}\n→ ${h(r.abody.slice(0, 240))}`;
  });
  await ctx.reply(`📚 <b>KB results for "${h(q)}":</b>\n\n${lines.join("\n\n")}`, { parse_mode: "HTML" });
}
