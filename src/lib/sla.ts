import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type Priority = "p0" | "p1" | "p2" | "p3";

export interface SlaTarget {
  responseMinutes: number;
  resolutionMinutes: number;
}

const DEFAULTS: Record<Priority, SlaTarget> = {
  p0: { responseMinutes: 15, resolutionMinutes: 60 },
  p1: { responseMinutes: 60, resolutionMinutes: 4 * 60 },
  p2: { responseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  p3: { responseMinutes: 24 * 60, resolutionMinutes: 3 * 24 * 60 },
};

const cache = new Map<string, { v: SlaTarget; at: number }>();
const TTL = 60_000;

export async function getSlaTarget(workspaceId: number, priority: Priority): Promise<SlaTarget> {
  const key = `${workspaceId}:${priority}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const r = await db()
    .select({ resp: schema.slaPolicies.responseMinutes, res: schema.slaPolicies.resolutionMinutes })
    .from(schema.slaPolicies)
    .where(and(eq(schema.slaPolicies.workspaceId, workspaceId), eq(schema.slaPolicies.priority, priority)))
    .limit(1);
  const v = r[0] ? { responseMinutes: r[0].resp, resolutionMinutes: r[0].res } : DEFAULTS[priority];
  cache.set(key, { v, at: Date.now() });
  return v;
}

export async function setSlaTarget(workspaceId: number, priority: Priority, t: SlaTarget) {
  await db()
    .insert(schema.slaPolicies)
    .values({
      workspaceId,
      priority,
      responseMinutes: t.responseMinutes,
      resolutionMinutes: t.resolutionMinutes,
    })
    .onConflictDoUpdate({
      target: [schema.slaPolicies.workspaceId, schema.slaPolicies.priority],
      set: { responseMinutes: t.responseMinutes, resolutionMinutes: t.resolutionMinutes, updatedAt: new Date() },
    });
  cache.delete(`${workspaceId}:${priority}`);
}

export function defaults() {
  return DEFAULTS;
}

export function percentConsumed(createdAt: Date, target: SlaTarget, now = new Date()): number {
  const elapsedMin = (now.getTime() - createdAt.getTime()) / 60000;
  return Math.max(0, Math.min(2, elapsedMin / target.resolutionMinutes));
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / (24 * 60))}d`;
}
