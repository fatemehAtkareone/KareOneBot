import type { Handler } from "@netlify/functions";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendMessage, h } from "@/lib/telegram";
import { log } from "@/lib/logger";

const OPEN = ["open", "assigned", "in_progress", "blocked", "in_review"] as const;

export const handler: Handler = async () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // For each member, fetch today's tasks
  const members = await db()
    .select({ userId: schema.users.id, telegramId: schema.users.telegramId })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.active, true));

  for (const m of members) {
    const rows = await db()
      .select({ id: schema.tasks.id, title: schema.tasks.title, dueAt: schema.tasks.dueAt })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(
        and(
          eq(schema.taskAssignees.userId, m.userId),
          inArray(schema.tasks.status, [...OPEN]),
          gte(schema.tasks.dueAt, start),
          lte(schema.tasks.dueAt, end)
        )
      );

    if (rows.length === 0) continue;

    const lines = rows.map((r) => `• <b>#${r.id}</b> ${h(r.title)}`).join("\n");
    const text = `📅 <b>Today's tasks</b>:\n${lines}`;
    await sendMessage(m.telegramId, text).catch((e) => log.warn("digest send failed", { err: String(e) }));
  }

  return { statusCode: 200, body: "ok" };
};
