import type { Context } from "grammy";
import { getMembershipByTelegramId, hasRole } from "@/lib/rbac";
import { getSlaTarget, setSlaTarget, defaults, formatMinutes, type Priority } from "@/lib/sla";
import { audit } from "@/lib/audit";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];
const LABEL: Record<Priority, string> = { p0: "🔴 P0", p1: "🟠 P1", p2: "🟡 P2", p3: "🟢 P3" };

export async function handleSla(ctx: Context, args: string[]) {
  const tg = ctx.from!;
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) return void ctx.reply("Not a member.");
  const sub = (args[0] ?? "").toLowerCase();

  if (!sub || sub === "show") {
    const lines = ["⏱️ <b>SLA policies</b> (response → resolution)"];
    for (const p of PRIORITIES) {
      const t = await getSlaTarget(m.workspaceId, p);
      lines.push(`${LABEL[p]} — ${formatMinutes(t.responseMinutes)} → ${formatMinutes(t.resolutionMinutes)}`);
    }
    lines.push("");
    lines.push("To change: <code>/sla set &lt;p0|p1|p2|p3&gt; &lt;response_min&gt; &lt;resolution_min&gt;</code>");
    lines.push("Defaults are restored if you delete a row.");
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    return;
  }

  if (sub === "defaults") {
    const d = defaults();
    const lines = ["⏱️ <b>Default SLA targets</b>"];
    for (const p of PRIORITIES) {
      lines.push(`${LABEL[p]} — ${formatMinutes(d[p].responseMinutes)} → ${formatMinutes(d[p].resolutionMinutes)}`);
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    return;
  }

  if (sub === "set") {
    if (!hasRole(m.role, "admin")) return void ctx.reply("Admins only.");
    const p = (args[1] ?? "").toLowerCase() as Priority;
    const resp = Number(args[2]);
    const reso = Number(args[3]);
    if (!PRIORITIES.includes(p) || !Number.isFinite(resp) || !Number.isFinite(reso) || resp <= 0 || reso <= 0) {
      await ctx.reply("Usage: /sla set <p0|p1|p2|p3> <response_min> <resolution_min>");
      return;
    }
    await setSlaTarget(m.workspaceId, p, { responseMinutes: resp, resolutionMinutes: reso });
    await audit({
      workspaceId: m.workspaceId,
      actorId: m.userId,
      action: "update",
      entity: "sla_policy",
      diff: { priority: p, response_minutes: resp, resolution_minutes: reso },
    });
    await ctx.reply(`✅ ${LABEL[p]} SLA → response ${formatMinutes(resp)}, resolution ${formatMinutes(reso)}.`, {
      parse_mode: "HTML",
    });
    return;
  }

  await ctx.reply("Usage: /sla [show|defaults|set <p> <resp> <reso>]");
}
