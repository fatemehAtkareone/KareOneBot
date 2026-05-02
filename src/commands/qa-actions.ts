import type { Context } from "grammy";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

export async function handleUpvote(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) return void ctx.reply(t(lc, "qa_use_upvote"));

  const exists = await db().select({ id: schema.answers.id })
    .from(schema.answers)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.answers.questionId))
    .where(and(eq(schema.answers.id, id), eq(schema.questions.workspaceId, m.workspaceId)))
    .limit(1);
  if (!exists[0]) return void ctx.reply(t(lc, "qa_answer_not_found", { id: String(id) }));

  const updated = await db().update(schema.answers)
    .set({ upvotes: sql`${schema.answers.upvotes} + 1` })
    .where(eq(schema.answers.id, id))
    .returning({ upvotes: schema.answers.upvotes });
  await ctx.reply(t(lc, "qa_upvoted", { id: String(id), n: String(updated[0]?.upvotes ?? 1) }));
}

export async function handleOfficial(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) return void ctx.reply(t(lc, "qa_use_official"));

  const ans = await db().select({
    id: schema.answers.id, questionId: schema.answers.questionId, isOfficial: schema.answers.isOfficial,
    askerId: schema.questions.askerId,
  })
    .from(schema.answers)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.answers.questionId))
    .where(and(eq(schema.answers.id, id), eq(schema.questions.workspaceId, m.workspaceId)))
    .limit(1);
  if (!ans[0]) return void ctx.reply(t(lc, "qa_answer_not_found", { id: String(id) }));
  if (ans[0].askerId !== m.userId) return void ctx.reply(t(lc, "qa_only_asker_can_official"));
  if (ans[0].isOfficial) return void ctx.reply(t(lc, "qa_already_official"));

  // Unmark any previous official on this question, then mark this one + resolve question
  await db().update(schema.answers).set({ isOfficial: false })
    .where(eq(schema.answers.questionId, ans[0].questionId));
  await db().update(schema.answers).set({ isOfficial: true }).where(eq(schema.answers.id, id));
  await db().update(schema.questions).set({ resolvedAt: new Date() })
    .where(eq(schema.questions.id, ans[0].questionId));
  await ctx.reply(t(lc, "qa_marked_official", { id: String(id) }));
}
