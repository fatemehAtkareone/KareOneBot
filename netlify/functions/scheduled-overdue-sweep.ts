import type { Handler } from "@netlify/functions";
import { and, eq, lt, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendMessage, h } from "@/lib/telegram";
import { redis } from "@/lib/redis";
import { log } from "@/lib/logger";

const OPEN = ["open", "assigned", "in_progress", "in_review"] as const;

export const handler: Handler = async () => {
  const now = new Date();
  const r = redis();

  const rows = await db()
    .select({
      taskId: schema.tasks.id,
      title: schema.tasks.title,
      dueAt: schema.tasks.dueAt,
      userId: schema.taskAssignees.userId,
      telegramId: schema.users.telegramId,
    })
    .from(schema.tasks)
    .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
    .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
    .where(and(inArray(schema.tasks.status, [...OPEN]), lt(schema.tasks.dueAt, now)));

  for (const row of rows) {
    const dedupKey = `notify:overdue:${row.taskId}:${row.userId}`;
    if (r) {
      const ok = await r.set(dedupKey, 1, { nx: true, ex: 24 * 60 * 60 });
      if (ok !== "OK") continue;
    }
    await sendMessage(row.telegramId, `🚨 Task <b>#${row.taskId}</b> is OVERDUE: ${h(row.title)}`).catch((e) =>
      log.warn("overdue send failed", { err: String(e) })
    );
  }

  return { statusCode: 200, body: `notified ${rows.length}` };
};
