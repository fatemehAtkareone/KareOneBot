import type { Handler } from "@netlify/functions";
import { and, eq, lt, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSlaTarget } from "@/lib/sla";
import { sendMessage, h } from "@/lib/telegram";
import { log } from "@/lib/logger";

const ACTIVE = ["open", "assigned", "in_progress", "blocked", "in_review"] as const;

/**
 * Hourly sweep:
 *   - For each active task, compute consumed % against the workspace's SLA target.
 *   - At ≥80%: send a warning to assignee(s) (idempotent via sla_escalations.kind = "warn80").
 *   - At ≥100%: escalate — message the assignee's manager (idempotent kind = "breach").
 */
export const handler: Handler = async () => {
  const tasks = await db()
    .select({
      id: schema.tasks.id,
      workspaceId: schema.tasks.workspaceId,
      title: schema.tasks.title,
      priority: schema.tasks.priority,
      createdAt: schema.tasks.createdAt,
    })
    .from(schema.tasks)
    .where(and(inArray(schema.tasks.status, [...ACTIVE]), lt(schema.tasks.createdAt, new Date(Date.now() - 30 * 60 * 1000))));

  let warns = 0, breaches = 0;

  for (const t of tasks) {
    const target = await getSlaTarget(t.workspaceId, t.priority as "p0" | "p1" | "p2" | "p3");
    const elapsedMin = (Date.now() - t.createdAt.getTime()) / 60000;
    const pct = elapsedMin / target.resolutionMinutes;

    if (pct >= 1.0) {
      const sent = await alreadyEscalated(t.id, "breach");
      if (!sent) {
        breaches += await escalate(t.id, t.workspaceId, t.title, "breach");
      }
    } else if (pct >= 0.8) {
      const sent = await alreadyEscalated(t.id, "warn80");
      if (!sent) {
        warns += await escalate(t.id, t.workspaceId, t.title, "warn80");
      }
    }
  }

  log.info("sla sweep done", { tasks: tasks.length, warns, breaches });
  return { statusCode: 200, body: `tasks=${tasks.length} warns=${warns} breaches=${breaches}` };
};

async function alreadyEscalated(taskId: number, kind: "warn80" | "breach"): Promise<boolean> {
  const r = await db()
    .select({ id: schema.slaEscalations.id })
    .from(schema.slaEscalations)
    .where(and(eq(schema.slaEscalations.taskId, taskId), eq(schema.slaEscalations.kind, kind)))
    .limit(1);
  return !!r[0];
}

async function escalate(taskId: number, workspaceId: number, title: string, kind: "warn80" | "breach"): Promise<number> {
  const assignees = await db()
    .select({ telegramId: schema.users.telegramId, userId: schema.users.id })
    .from(schema.taskAssignees)
    .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
    .where(eq(schema.taskAssignees.taskId, taskId));

  let count = 0;
  if (kind === "warn80") {
    for (const a of assignees) {
      await sendMessage(
        a.telegramId,
        `⚠️ <b>SLA warning</b>\nTask <b>#${taskId}</b> · ${h(title)}\n80% of SLA window consumed.`,
        { reply_markup: { inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${taskId}` }]] } }
      ).catch(() => {});
      await db().insert(schema.slaEscalations).values({ taskId, kind: "warn80", notifiedUserId: a.userId });
      count++;
    }
    return count;
  }

  // breach: escalate to managers
  const managers = await db()
    .select({
      managerId: schema.memberships.managerId,
    })
    .from(schema.memberships)
    .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.userId, schema.memberships.userId))
    .where(
      and(
        eq(schema.taskAssignees.taskId, taskId),
        eq(schema.memberships.workspaceId, workspaceId),
        sql`${schema.memberships.managerId} IS NOT NULL`
      )
    );

  const managerIds = Array.from(new Set(managers.map((m) => m.managerId).filter((x): x is number => !!x)));
  let targetTelegrams: { telegramId: number; userId: number }[] = [];

  if (managerIds.length > 0) {
    const rows = await db()
      .select({ telegramId: schema.users.telegramId, userId: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.id, managerIds));
    targetTelegrams = rows;
  } else {
    // Fallback: notify all admins / super-admins of the workspace
    const rows = await db()
      .select({ telegramId: schema.users.telegramId, userId: schema.users.id })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(
        and(
          eq(schema.memberships.workspaceId, workspaceId),
          inArray(schema.memberships.role, ["admin", "super_admin"])
        )
      );
    targetTelegrams = rows;
  }

  for (const t of targetTelegrams) {
    await sendMessage(
      t.telegramId,
      `🚨 <b>SLA BREACHED</b>\nTask <b>#${taskId}</b> · ${h(title)}\nResolution window exceeded.`,
      { reply_markup: { inline_keyboard: [[{ text: "👁️ View task", callback_data: `t:view:${taskId}` }]] } }
    ).catch(() => {});
    await db().insert(schema.slaEscalations).values({ taskId, kind: "breach", notifiedUserId: t.userId });
    count++;
  }

  return count;
}

// keep unused import valid for tooling
export type _ = typeof isNull;
