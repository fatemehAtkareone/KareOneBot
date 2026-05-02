import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { audit } from "@/lib/audit";
import { userLang } from "@/lib/locale";

export async function handleDone(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) {
    await ctx.reply(t(lc, "invalid_format", { usage: "/done <id>" }));
    return;
  }

  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const updated = await db()
    .update(schema.tasks)
    .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId)))
    .returning({ id: schema.tasks.id });

  if (!updated[0]) {
    await ctx.reply(t(lc, "task_not_found", { id: String(id) }), { parse_mode: "HTML" });
    return;
  }

  await audit({
    workspaceId: m.workspaceId,
    actorId: m.userId,
    action: "status_change",
    entity: "task",
    entityId: id,
    diff: { status: "done" },
  });
  await ctx.reply(t(lc, "task_done", { id: String(id) }), { parse_mode: "HTML" });
}
