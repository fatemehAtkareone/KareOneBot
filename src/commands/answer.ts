import type { Context } from "grammy";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { h, sendMessage } from "@/lib/telegram";
import { displayName } from "@/lib/users";
import { setState, clearState, getState } from "@/lib/redis";
import { log } from "@/lib/logger";

interface AnswerInputState {
  flow: "answer";
  questionId: number;
}

/** /answer <id> <text>  OR  /answer <id> (then prompt for text) */
export async function handleAnswer(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member of this workspace.");
  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^[Q#]/i, "").replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) {
    await ctx.reply("Usage: /answer <question_id> <text>");
    return;
  }
  const body = args.slice(1).join(" ").trim();
  if (body) {
    await persistAnswer(ctx, m.userId, m.workspaceId, id, body);
    return;
  }
  await setState<AnswerInputState>(ctx.chat!.id, tg.id, { flow: "answer", questionId: id });
  await ctx.reply(`💬 Send your answer to Q#${id} (or /cancel):`);
}

export async function consumeAnswerInput(ctx: Context, state: AnswerInputState) {
  const tg = ctx.from!;
  const text = ctx.message?.text?.trim();
  if (!text) return;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await clearState(ctx.chat!.id, tg.id);
    return;
  }
  await persistAnswer(ctx, m.userId, m.workspaceId, state.questionId, text);
  await clearState(ctx.chat!.id, tg.id);
}

async function persistAnswer(
  ctx: Context,
  userId: number,
  workspaceId: number,
  questionId: number,
  body: string
) {
  const q = await db()
    .select({
      id: schema.questions.id,
      askerId: schema.questions.askerId,
      body: schema.questions.body,
      anonymous: schema.questions.anonymous,
    })
    .from(schema.questions)
    .where(and(eq(schema.questions.id, questionId), eq(schema.questions.workspaceId, workspaceId)))
    .limit(1);
  if (!q[0]) {
    await ctx.reply(`Q#${questionId} not found.`);
    return;
  }
  await db().insert(schema.answers).values({
    questionId,
    authorId: userId,
    body: body.slice(0, 4000),
  });

  // Notify the asker
  const asker = await db()
    .select({ telegramId: schema.users.telegramId })
    .from(schema.users)
    .where(eq(schema.users.id, q[0].askerId))
    .limit(1);
  if (asker[0]) {
    await sendMessage(
      asker[0].telegramId,
      `💬 New answer on Q#${questionId} from <b>${h(displayName(ctx.from!))}</b>:\n${h(body.slice(0, 600))}`
    ).catch((e) => log.warn("answer notify failed", { err: String(e) }));
  }

  await ctx.reply(`✅ Answer posted to Q#${questionId}.`);
}

/** /questions — list open questions in this workspace */
export async function handleListQuestions(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");
  const rows = await db()
    .select({
      id: schema.questions.id,
      body: schema.questions.body,
      createdAt: schema.questions.createdAt,
    })
    .from(schema.questions)
    .where(and(eq(schema.questions.workspaceId, m.workspaceId), isNull(schema.questions.resolvedAt)))
    .orderBy(desc(schema.questions.createdAt))
    .limit(15);
  if (rows.length === 0) {
    await ctx.reply("No open questions. ✨");
    return;
  }
  const lines = rows.map((r) => `❓ <b>Q#${r.id}</b> · ${h(r.body.slice(0, 120))}`);
  await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });
}
