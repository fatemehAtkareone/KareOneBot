import type { Handler } from "@netlify/functions";
import { and, isNotNull, lte } from "drizzle-orm";
import { RRule } from "rrule";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Phase 1 stub: scans tasks with `recurrence_rule`, and if the next occurrence
 * is due, clones the task as a new instance. Full RRULE bookkeeping is left
 * for Phase 2 (a separate `recurrences` table tracking last spawn).
 */
export const handler: Handler = async () => {
  const candidates = await db()
    .select({
      id: schema.tasks.id,
      workspaceId: schema.tasks.workspaceId,
      title: schema.tasks.title,
      description: schema.tasks.description,
      priority: schema.tasks.priority,
      creatorId: schema.tasks.creatorId,
      recurrenceRule: schema.tasks.recurrenceRule,
      dueAt: schema.tasks.dueAt,
    })
    .from(schema.tasks)
    .where(and(isNotNull(schema.tasks.recurrenceRule), lte(schema.tasks.dueAt, new Date())));

  let spawned = 0;
  for (const t of candidates) {
    if (!t.recurrenceRule) continue;
    try {
      const rule = RRule.fromString(t.recurrenceRule);
      const next = rule.after(new Date(), true);
      if (!next) continue;
      await db().insert(schema.tasks).values({
        workspaceId: t.workspaceId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        creatorId: t.creatorId,
        dueAt: next,
        status: "open",
      });
      spawned++;
    } catch (e) {
      log.warn("recurrence parse failed", { taskId: t.id, err: String(e) });
    }
  }

  return { statusCode: 200, body: `spawned ${spawned}` };
};
