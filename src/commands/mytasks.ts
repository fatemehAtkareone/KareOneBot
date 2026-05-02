import type { Context } from "grammy";
import { and, eq, lte, gte, ne, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { md } from "@/lib/telegram";
import { formatDue } from "@/lib/dueparse";

const OPEN_STATUSES = ["open", "assigned", "in_progress", "blocked", "in_review"] as const;

async function listAssigned(userId: number, workspaceId: number, opts?: { dueBefore?: Date; dueAfter?: Date }) {
  const conds = [
    eq(schema.taskAssignees.userId, userId),
    eq(schema.tasks.workspaceId, workspaceId),
    inArray(schema.tasks.status, [...OPEN_STATUSES]),
    ne(schema.tasks.status, "done"),
  ];
  if (opts?.dueBefore) conds.push(lte(schema.tasks.dueAt, opts.dueBefore));
  if (opts?.dueAfter) conds.push(gte(schema.tasks.dueAt, opts.dueAfter));

  return db()
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      dueAt: schema.tasks.dueAt,
    })
    .from(schema.tasks)
    .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
    .where(and(...conds))
    .orderBy(schema.tasks.dueAt)
    .limit(50);
}

function renderList(rows: { id: number; title: string; status: string; dueAt: Date | null }[], lc: string | undefined, tz: string) {
  if (rows.length === 0) return t(lc, "no_tasks");
  return rows
    .map((r) =>
      t(lc, "task_line", {
        id: String(r.id),
        title: md(r.title),
        status: r.status,
        due: r.dueAt ? t(lc, "due_label", { due: md(formatDue(r.dueAt, tz, lc ?? "fa")) }) : "",
      })
    )
    .join("\n");
}

export async function handleMyTasks(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(tg.language_code, "not_member"));
  const rows = await listAssigned(m.userId, m.workspaceId);
  await ctx.reply(renderList(rows, tg.language_code, "Asia/Tehran"), { parse_mode: "MarkdownV2" });
}

export async function handleToday(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(tg.language_code, "not_member"));
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const rows = await listAssigned(m.userId, m.workspaceId, { dueBefore: end });
  await ctx.reply(renderList(rows, tg.language_code, "Asia/Tehran"), { parse_mode: "MarkdownV2" });
}

export async function handleOverdue(ctx: Context) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(tg.language_code, "not_member"));
  const rows = await listAssigned(m.userId, m.workspaceId, { dueBefore: new Date() });
  await ctx.reply(renderList(rows, tg.language_code, "Asia/Tehran"), { parse_mode: "MarkdownV2" });
}
