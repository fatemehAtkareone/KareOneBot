import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { md, sendMessage } from "@/lib/telegram";
import { displayName } from "@/lib/users";
import { log } from "@/lib/logger";

export async function handleAsk(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = tg.language_code;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const first = args[0];
  if (!first) {
    await ctx.reply(t(lc, "invalid_format", { usage: "/ask @username <question> | /ask #tag <question>" }));
    return;
  }

  const usernameMatch = first.match(/^@([A-Za-z0-9_]{3,32})$/);
  const tagMatch = first.match(/^#([A-Za-z0-9_-]{2,40})$/);
  const body = args.slice(1).join(" ").trim();
  if (!body) {
    await ctx.reply(t(lc, "invalid_format", { usage: "/ask @username <question>" }));
    return;
  }

  let targetUserId: number | null = null;
  let targetTelegramId: number | null = null;
  let targetTag: string | null = null;

  if (usernameMatch) {
    const target = await db()
      .select({ id: schema.users.id, telegramId: schema.users.telegramId })
      .from(schema.users)
      .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
      .where(
        and(
          eq(schema.users.telegramUsername, usernameMatch[1]!),
          eq(schema.memberships.workspaceId, m.workspaceId)
        )
      )
      .limit(1);
    if (!target[0]) {
      await ctx.reply(`@${usernameMatch[1]} is not in this workspace.`);
      return;
    }
    targetUserId = target[0].id;
    targetTelegramId = target[0].telegramId;
  } else if (tagMatch) {
    targetTag = tagMatch[1]!;
  } else {
    await ctx.reply(t(lc, "invalid_format", { usage: "/ask @username <question> | /ask #tag <question>" }));
    return;
  }

  const [q] = await db()
    .insert(schema.questions)
    .values({
      workspaceId: m.workspaceId,
      askerId: m.userId,
      body,
      targetUserId,
      targetTag,
    })
    .returning({ id: schema.questions.id });

  if (targetTelegramId) {
    await sendMessage(
      targetTelegramId,
      `❓ ${md(`Question from ${displayName(tg)} (Q#${q!.id}):`)}\n${md(body)}`
    ).catch((e) => log.warn("ask deliver failed", { err: String(e) }));
  }

  await ctx.reply(`📨 Question #${q!.id} sent.`);
}
