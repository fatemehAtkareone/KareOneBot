import { db, schema } from "@/lib/db";

type Action = "create" | "update" | "delete" | "assign" | "status_change" | "comment" | "login" | "invite";

export async function audit(params: {
  workspaceId?: number | null;
  actorId?: number | null;
  action: Action;
  entity: string;
  entityId?: number | null;
  diff?: Record<string, unknown>;
}) {
  await db().insert(schema.auditLog).values({
    workspaceId: params.workspaceId ?? null,
    actorId: params.actorId ?? null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId ?? null,
    diff: params.diff ?? null,
  });
}
