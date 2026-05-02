import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { redis } from "@/lib/redis";
import { audit } from "@/lib/audit";

export async function handleWork(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");
  const sub = (args[0] ?? "").toLowerCase();
  const idArg = args[1];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;

  if (!["start", "stop", "status"].includes(sub)) {
    await ctx.reply("Usage: /work start <task_id> · /work stop <task_id> · /work status");
    return;
  }
  const r = redis();
  if (!r) {
    await ctx.reply("Time tracking requires Redis.");
    return;
  }

  if (sub === "status") {
    const pattern = `timer:${m.userId}:*`;
    const keys = await r.keys(pattern);
    if (keys.length === 0) {
      await ctx.reply("No timers running.");
      return;
    }
    const lines: string[] = [];
    for (const k of keys) {
      const taskId = Number(k.split(":").at(-1));
      const startedAt = await r.get<number>(k);
      if (!startedAt) continue;
      const mins = Math.floor((Date.now() - Number(startedAt)) / 60000);
      lines.push(`⏱️ #${taskId} — running ${mins} min`);
    }
    await ctx.reply(lines.join("\n"));
    return;
  }

  if (!Number.isInteger(id)) {
    await ctx.reply(`Usage: /work ${sub} <task_id>`);
    return;
  }

  if (sub === "start") {
    await r.set(`timer:${m.userId}:${id}`, Date.now(), { ex: 60 * 60 * 12 });
    await db().update(schema.tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.tasks.id, id));
    await ctx.reply(`▶️ Timer started on task #${id}.`);
    return;
  }

  if (sub === "stop") {
    const startedAt = await r.get<number>(`timer:${m.userId}:${id}`);
    if (!startedAt) {
      await ctx.reply(`No timer running on #${id}.`);
      return;
    }
    const minutes = Math.max(1, Math.floor((Date.now() - Number(startedAt)) / 60000));
    await r.del(`timer:${m.userId}:${id}`);
    await db().insert(schema.comments).values({ taskId: id, authorId: m.userId, body: `⏱️ Logged ${minutes} min` });
    const cur = await db().select({ actual: schema.tasks.actualMinutes }).from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    await db().update(schema.tasks).set({ actualMinutes: (cur[0]?.actual ?? 0) + minutes, updatedAt: new Date() }).where(eq(schema.tasks.id, id));
    await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: id, diff: { loggedMinutes: minutes } });
    await ctx.reply(`⏹️ Timer stopped. Logged <b>${minutes} min</b> on #${id}.`, { parse_mode: "HTML" });
  }
}
