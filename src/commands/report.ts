import type { Context } from "grammy";
import { eq, sql, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";

/** /report — workspace + personal stats */
export async function handleReport(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");

  const wsId = m.workspaceId;
  const userId = m.userId;

  const [byStatus, byPriority, openCountForUser, doneCountForUserWeek, overdueCountForUser, totalLoggedUserMin] =
    await Promise.all([
      db()
        .select({ status: schema.tasks.status, n: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .where(eq(schema.tasks.workspaceId, wsId))
        .groupBy(schema.tasks.status),

      db()
        .select({ priority: schema.tasks.priority, n: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .where(eq(schema.tasks.workspaceId, wsId))
        .groupBy(schema.tasks.priority),

      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
        .where(
          and(
            eq(schema.tasks.workspaceId, wsId),
            eq(schema.taskAssignees.userId, userId),
            sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`
          )
        ),

      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
        .where(
          and(
            eq(schema.tasks.workspaceId, wsId),
            eq(schema.taskAssignees.userId, userId),
            eq(schema.tasks.status, "done"),
            sql`${schema.tasks.completedAt} >= NOW() - INTERVAL '7 days'`
          )
        ),

      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
        .where(
          and(
            eq(schema.tasks.workspaceId, wsId),
            eq(schema.taskAssignees.userId, userId),
            sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`,
            sql`${schema.tasks.dueAt} < NOW()`
          )
        ),

      db()
        .select({ n: sql<number>`COALESCE(SUM(${schema.tasks.actualMinutes}), 0)::int` })
        .from(schema.tasks)
        .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
        .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId))),
    ]);

  const STATUS_EMOJI: Record<string, string> = {
    open: "📂",
    assigned: "📌",
    in_progress: "🔧",
    blocked: "🛑",
    in_review: "👀",
    done: "✅",
    cancelled: "❌",
    rejected: "🚫",
    archived: "🗄️",
    draft: "📝",
  };
  const PR_EMOJI: Record<string, string> = { p0: "🔴", p1: "🟠", p2: "🟡", p3: "🟢" };

  const totalTasks = byStatus.reduce((s, r) => s + r.n, 0);
  const max = Math.max(1, ...byStatus.map((r) => r.n));

  const lines: string[] = [];
  lines.push(`📊 <b>Workspace report</b>`);
  lines.push("");
  lines.push(`<b>Tasks by status</b> (total ${totalTasks})`);
  for (const r of byStatus) {
    const bar = "█".repeat(Math.round((r.n / max) * 12));
    lines.push(`${STATUS_EMOJI[r.status] ?? "•"} ${r.status.padEnd(13)} ${bar} ${r.n}`);
  }
  lines.push("");
  lines.push(`<b>Tasks by priority</b>`);
  for (const r of byPriority) {
    lines.push(`${PR_EMOJI[r.priority] ?? "•"} ${r.priority.toUpperCase()}: ${r.n}`);
  }
  lines.push("");
  lines.push(`<b>You</b>`);
  lines.push(`📥 Open: ${openCountForUser[0]?.n ?? 0}`);
  lines.push(`✅ Done in last 7 days: ${doneCountForUserWeek[0]?.n ?? 0}`);
  lines.push(`🚨 Overdue: ${overdueCountForUser[0]?.n ?? 0}`);
  const mins = Number(totalLoggedUserMin[0]?.n ?? 0);
  lines.push(`⏱️ Total logged time: ${Math.floor(mins / 60)}h ${mins % 60}m`);

  await ctx.reply(`<pre>${lines.join("\n")}</pre>`, { parse_mode: "HTML" });
}
