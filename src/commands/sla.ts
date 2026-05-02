import type { Context } from "grammy";
import { getMembershipByTelegramId, hasRole } from "@/lib/rbac";
import { getSlaTarget, setSlaTarget, defaults, formatMinutes, type Priority } from "@/lib/sla";
import { audit } from "@/lib/audit";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];
const LABEL: Record<Priority, string> = { p0: "🔴 P0", p1: "🟠 P1", p2: "🟡 P2", p3: "🟢 P3" };

export async function handleSla(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply(t(lc, "not_member"));
  const sub = (args[0] ?? "").toLowerCase();

  if (!sub || sub === "show") {
    const lines = [t(lc, "sla_header")];
    for (const p of PRIORITIES) {
      const tt = await getSlaTarget(m.workspaceId, p);
      lines.push(`${LABEL[p]} — ${formatMinutes(tt.responseMinutes)} → ${formatMinutes(tt.resolutionMinutes)}`);
    }
    lines.push("");
    lines.push(t(lc, "sla_change_hint"));
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    return;
  }

  if (sub === "defaults") {
    const d = defaults();
    const lines = [t(lc, "sla_defaults_header")];
    for (const p of PRIORITIES) {
      lines.push(`${LABEL[p]} — ${formatMinutes(d[p].responseMinutes)} → ${formatMinutes(d[p].resolutionMinutes)}`);
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    return;
  }

  if (sub === "set") {
    if (!hasRole(m.role, "admin")) return void ctx.reply(t(lc, "sla_admin_only"));
    const p = (args[1] ?? "").toLowerCase() as Priority;
    const resp = Number(args[2]);
    const reso = Number(args[3]);
    if (!PRIORITIES.includes(p) || !Number.isFinite(resp) || !Number.isFinite(reso) || resp <= 0 || reso <= 0) {
      await ctx.reply(t(lc, "sla_use"));
      return;
    }
    await setSlaTarget(m.workspaceId, p, { responseMinutes: resp, resolutionMinutes: reso });
    await audit({
      workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "sla_policy",
      diff: { priority: p, response_minutes: resp, resolution_minutes: reso },
    });
    await ctx.reply(t(lc, "sla_set", { priority: LABEL[p], resp: formatMinutes(resp), reso: formatMinutes(reso) }), {
      parse_mode: "HTML",
    });
    return;
  }

  await ctx.reply(t(lc, "sla_use"));
}
