import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { redis } from "@/lib/redis";
import { audit } from "@/lib/audit";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

export async function handleWork(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));
  const sub = (args[0] ?? "").toLowerCase();
  const idArg = args[1];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;

  if (!["start", "stop", "status"].includes(sub)) {
    await ctx.reply(t(lc, "work_use"));
    return;
  }
  const r = redis();
  if (!r) {
    await ctx.reply(t(lc, "timers_require_redis"));
    return;
  }

  if (sub === "status") {
    const keys = await r.keys(`timer:${m.userId}:*`);
    if (keys.length === 0) {
      await ctx.reply(t(lc, "work_no_timers"));
      return;
    }
    const lines: string[] = [];
    for (const k of keys) {
      const taskId = Number(k.split(":").at(-1));
      const startedAt = await r.get<number>(k);
      if (!startedAt) continue;
      const mins = Math.floor((Date.now() - Number(startedAt)) / 60000);
      lines.push(t(lc, "work_status_line", { id: String(taskId), m: String(mins) }));
    }
    await ctx.reply(lines.join("\n"));
    return;
  }

  if (!Number.isInteger(id)) {
    await ctx.reply(t(lc, "work_use"));
    return;
  }

  if (sub === "start") {
    await r.set(`timer:${m.userId}:${id}`, Date.now(), { ex: 60 * 60 * 12 });
    await db().update(schema.tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.tasks.id, id));
    await ctx.reply(t(lc, "work_started", { id: String(id) }));
    return;
  }

  if (sub === "stop") {
    const startedAt = await r.get<number>(`timer:${m.userId}:${id}`);
    if (!startedAt) {
      await ctx.reply(t(lc, "work_no_timer_on", { id: String(id) }));
      return;
    }
    const minutes = Math.max(1, Math.floor((Date.now() - Number(startedAt)) / 60000));
    await r.del(`timer:${m.userId}:${id}`);
    await db().insert(schema.comments).values({ taskId: id, authorId: m.userId, body: `⏱️ +${minutes} min` });
    const cur = await db().select({ actual: schema.tasks.actualMinutes }).from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    await db().update(schema.tasks).set({ actualMinutes: (cur[0]?.actual ?? 0) + minutes, updatedAt: new Date() }).where(eq(schema.tasks.id, id));
    await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: id, diff: { loggedMinutes: minutes } });
    await ctx.reply(t(lc, "work_stopped", { m: String(minutes), id: String(id) }), { parse_mode: "HTML" });
  }
}
