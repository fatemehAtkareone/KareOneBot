import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";
import { h } from "@/lib/telegram";

export async function handleProjectsList(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const rows = await db()
    .select({ id: schema.projects.id, name: schema.projects.name, description: schema.projects.description })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, m.workspaceId), eq(schema.projects.archived, false)))
    .orderBy(schema.projects.name);

  if (rows.length === 0) {
    await ctx.reply(t(lc, "proj_none"));
    return;
  }
  const lines = [t(lc, "proj_list_header"), ""];
  for (const p of rows) lines.push(`🗂️ <b>#${p.id}</b> · ${h(p.name)}${p.description ? ` — <i>${h(p.description)}</i>` : ""}`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

export async function handleNewProject(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));

  const name = args.join(" ").trim();
  if (!name) return void ctx.reply(t(lc, "proj_use_create"));

  const [proj] = await db()
    .insert(schema.projects)
    .values({ workspaceId: m.workspaceId, name: name.slice(0, 120) })
    .returning({ id: schema.projects.id });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "project", entityId: proj!.id, diff: { name } });
  await ctx.reply(t(lc, "proj_created", { id: String(proj!.id), name: h(name) }), { parse_mode: "HTML" });
}
