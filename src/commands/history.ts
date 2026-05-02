import type { Context } from "grammy";
import { and, eq, desc } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import { h } from "@/lib/telegram";

const TZ = "Asia/Tehran";

export async function handleHistory(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const idArg = args[0];
  const id = idArg ? Number(idArg.replace(/^#/, "")) : NaN;
  if (!Number.isInteger(id)) return void ctx.reply(t(lc, "history_use"));

  const task = await db().select({ id: schema.tasks.id }).from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
  if (!task[0]) return void ctx.reply(t(lc, "task_not_found", { id: String(id) }));

  const rows = await db()
    .select({
      action: schema.auditLog.action, diff: schema.auditLog.diff, createdAt: schema.auditLog.createdAt,
      first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .where(and(eq(schema.auditLog.entity, "task"), eq(schema.auditLog.entityId, id)))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(40);

  if (rows.length === 0) return void ctx.reply(t(lc, "history_empty"));

  const lines = [t(lc, "history_header", { id: String(id) }), ""];
  for (const r of rows.reverse()) {
    const when = DateTime.fromJSDate(r.createdAt).setZone(TZ).toFormat("LL-dd HH:mm");
    const who = [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "system");
    const summary = r.diff ? compactDiff(r.diff) : "";
    lines.push(`<code>${when}</code> · ${h(who)} · <b>${r.action}</b>${summary ? ` — ${h(summary)}` : ""}`);
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

function compactDiff(diff: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(diff)) {
    if (v === null || v === undefined) continue;
    const s = typeof v === "string" ? v : JSON.stringify(v);
    parts.push(`${k}=${s.length > 30 ? s.slice(0, 27) + "…" : s}`);
  }
  return parts.join(" · ");
}
