import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId, hasRole } from "@/lib/rbac";
import { t } from "@/i18n";
import { audit } from "@/lib/audit";
import { h, sendMessage } from "@/lib/telegram";
import { userLang } from "@/lib/locale";
import { log } from "@/lib/logger";

export async function handleAssign(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const idArg = args[0];
  const userArg = args[1];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  const usernameMatch = userArg?.match(/^@([A-Za-z0-9_]{3,32})$/);

  if (!Number.isInteger(id) || !usernameMatch) {
    await ctx.reply(t(lc, "invalid_format", { usage: "/assign <id> @username" }));
    return;
  }

  const task = await db()
    .select({ id: schema.tasks.id, creatorId: schema.tasks.creatorId })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId)))
    .limit(1);
  if (!task[0]) {
    await ctx.reply(t(lc, "task_not_found", { id: String(id) }), { parse_mode: "HTML" });
    return;
  }

  const isCreator = task[0].creatorId === m.userId;
  if (!isCreator && !hasRole(m.role, "manager")) {
    await ctx.reply(t(lc, "permission_denied"));
    return;
  }

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
    await ctx.reply(`User @${usernameMatch[1]} is not in this workspace.`);
    return;
  }

  await db().delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, id));
  await db().insert(schema.taskAssignees).values({ taskId: id, userId: target[0].id });
  await db().update(schema.tasks).set({ status: "assigned", updatedAt: new Date() }).where(eq(schema.tasks.id, id));

  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "assign",
    entity: "task",
    entityId: id,
    diff: { assigneeUserId: target[0].id },
  });

  await sendMessage(target[0].telegramId, `🆕 Task <b>#${id}</b> assigned to you.`).catch((e) =>
    log.warn("notify failed", { err: String(e) })
  );

  await ctx.reply(`✅ Reassigned task #${id} to @${h(usernameMatch[1]!)}.`, { parse_mode: "HTML" });
}
