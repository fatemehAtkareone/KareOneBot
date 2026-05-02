import type { Context } from "grammy";
import { InputFile } from "grammy";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

const TZ = "Asia/Tehran";

export async function handleExport(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const rows = await db()
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      dueAt: schema.tasks.dueAt,
      createdAt: schema.tasks.createdAt,
      actualMinutes: schema.tasks.actualMinutes,
    })
    .from(schema.tasks)
    .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId), eq(schema.taskAssignees.userId, m.userId)))
    .orderBy(schema.tasks.id);

  if (rows.length === 0) return void ctx.reply(t(lc, "export_empty"));

  const header = "id,title,status,priority,due,created,logged_min";
  const csv = [header]
    .concat(rows.map((r) => [
      r.id,
      escape(r.title),
      r.status,
      r.priority,
      r.dueAt ? DateTime.fromJSDate(r.dueAt).setZone(TZ).toISO() : "",
      DateTime.fromJSDate(r.createdAt).setZone(TZ).toISO(),
      r.actualMinutes ?? 0,
    ].join(",")))
    .join("\n");

  const buf = Buffer.from("﻿" + csv, "utf8"); // BOM so Excel + Persian render correctly
  await ctx.replyWithDocument(new InputFile(buf, `kareone-tasks-${Date.now()}.csv`), {
    caption: t(lc, "export_caption", { n: String(rows.length) }),
  });
}

function escape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
