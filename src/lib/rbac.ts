import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type Role = "super_admin" | "admin" | "manager" | "member" | "guest";

const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  member: 1,
  manager: 2,
  admin: 3,
  super_admin: 4,
};

export interface Membership {
  membershipId: number;
  workspaceId: number;
  userId: number;
  role: Role;
  active: boolean;
}

/** Find a user's active membership in any workspace (Phase 1: assume single workspace). */
export async function getMembershipByTelegramId(
  telegramId: number
): Promise<Membership | null> {
  const rows = await db()
    .select({
      membershipId: schema.memberships.id,
      workspaceId: schema.memberships.workspaceId,
      userId: schema.users.id,
      role: schema.memberships.role,
      active: schema.memberships.active,
    })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.users.telegramId, telegramId), eq(schema.memberships.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function assertRole(membership: Membership | null, required: Role): asserts membership is Membership {
  if (!membership) throw new RbacError("not_a_member");
  if (!hasRole(membership.role, required)) throw new RbacError("insufficient_role");
}

export class RbacError extends Error {
  constructor(public code: "not_a_member" | "insufficient_role") {
    super(code);
  }
}
