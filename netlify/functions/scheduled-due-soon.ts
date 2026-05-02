import type { Handler } from "@netlify/functions";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendMessage, h } from "@/lib/telegram";
import { redis } from "@/lib/redis";
import { log } from "@/lib/logger";

const OPEN = ["open", "assigned", "in_progress", "in_review"] as const;

export const handler: Handler = async () => {
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 60 * 1000); // next 60 minutes
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
    .where(and(inArray(schema.tasks.status, [...OPEN]), gte(schema.tasks.dueAt, now), lte(schema.tasks.dueAt, horizon)));

  for (const row of rows) {
    const dedupKey = `notify:duesoon:${row.taskId}:${row.userId}`;
    if (r) {
      const ok = await r.set(dedupKey, 1, { nx: true, ex: 6 * 60 * 60 });
      if (ok !== "OK") continue;
    }
    await sendMessage(row.telegramId, `⏰ Task <b>#${row.taskId}</b> is due soon: ${h(row.title)}`).catch((e) =>
      log.warn("due-soon send failed", { err: String(e) })
    );
  }

  return { statusCode: 200, body: `notified ${rows.length}` };
};
