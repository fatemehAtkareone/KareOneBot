import type { Context } from "grammy";
import { eq, sql, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

export async function handleReport(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const wsId = m.workspaceId;
  const userId = m.userId;

  const [byStatus, byPriority, openCount, doneWeek, overdueCount, totalLogged] = await Promise.all([
    db().select({ status: schema.tasks.status, n: sql<number>`count(*)::int` })
      .from(schema.tasks).where(eq(schema.tasks.workspaceId, wsId)).groupBy(schema.tasks.status),
    db().select({ priority: schema.tasks.priority, n: sql<number>`count(*)::int` })
      .from(schema.tasks).where(eq(schema.tasks.workspaceId, wsId)).groupBy(schema.tasks.priority),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(
        eq(schema.tasks.workspaceId, wsId),
        eq(schema.taskAssignees.userId, userId),
        sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`
      )),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(
        eq(schema.tasks.workspaceId, wsId),
        eq(schema.taskAssignees.userId, userId),
        eq(schema.tasks.status, "done"),
        sql`${schema.tasks.completedAt} >= NOW() - INTERVAL '7 days'`
      )),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(
        eq(schema.tasks.workspaceId, wsId),
        eq(schema.taskAssignees.userId, userId),
        sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`,
        sql`${schema.tasks.dueAt} < NOW()`
      )),
    db().select({ n: sql<number>`COALESCE(SUM(${schema.tasks.actualMinutes}), 0)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId))),
  ]);

  const STATUS_E: Record<string, string> = {
    open: "📂", assigned: "📌", in_progress: "🔧", blocked: "🛑",
    in_review: "👀", done: "✅", cancelled: "❌", rejected: "🚫", archived: "🗄️", draft: "📝",
  };
  const PR_E: Record<string, string> = { p0: "🔴", p1: "🟠", p2: "🟡", p3: "🟢" };

  const totalTasks = byStatus.reduce((s, r) => s + r.n, 0);
  const max = Math.max(1, ...byStatus.map((r) => r.n));

  const lines: string[] = [];
  lines.push(t(lc, "report_title"));
  lines.push("");
  lines.push(t(lc, "report_status", { total: String(totalTasks) }));
  for (const r of byStatus) {
    const bar = "█".repeat(Math.round((r.n / max) * 12));
    lines.push(`${STATUS_E[r.status] ?? "•"} ${r.status.padEnd(13)} ${bar} ${r.n}`);
  }
  lines.push("");
  lines.push(t(lc, "report_priority"));
  for (const r of byPriority) lines.push(`${PR_E[r.priority] ?? "•"} ${r.priority.toUpperCase()}: ${r.n}`);
  lines.push("");
  lines.push(t(lc, "report_you"));
  lines.push(t(lc, "report_open", { n: String(openCount[0]?.n ?? 0) }));
  lines.push(t(lc, "report_done_week", { n: String(doneWeek[0]?.n ?? 0) }));
  lines.push(t(lc, "report_overdue", { n: String(overdueCount[0]?.n ?? 0) }));
  const mins = Number(totalLogged[0]?.n ?? 0);
  lines.push(t(lc, "report_logged", { h: String(Math.floor(mins / 60)), m: String(mins % 60) }));

  await ctx.reply(`<pre>${lines.join("\n")}</pre>`, { parse_mode: "HTML" });
}
