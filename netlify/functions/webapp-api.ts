import type { Handler } from "@netlify/functions";
import { and, eq, sql, desc, asc, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { authenticate } from "@/lib/webapp-auth";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * Single function fronting all Mini App API needs. Internal router by `op`.
 *
 * POST /.netlify/functions/webapp-api
 * Body: { initData, op, params }
 *
 * All operations are workspace-scoped via the authenticated session.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resp(405, { error: "method_not_allowed" });
  }
  let body: { initData?: string; op?: string; params?: Record<string, unknown> };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return resp(400, { error: "bad_json" });
  }
  const initData = body.initData ?? "";
  const op = body.op ?? "";
  const p = (body.params ?? {}) as Record<string, unknown>;

  const session = await authenticate(initData);
  if (!session) return resp(401, { error: "unauthorized" });

  const { membership: m, tgUser } = session;

  try {
    switch (op) {
      case "me":            return resp(200, await opMe(m, tgUser));
      case "stats":         return resp(200, await opStats(m));
      case "tasks":         return resp(200, await opTasks(m, p));
      case "task":          return resp(200, await opTask(m, p));
      case "kanban":        return resp(200, await opKanban(m));
      case "projects":      return resp(200, await opProjects(m));
      case "questions":     return resp(200, await opQuestions(m));
      case "members":       return resp(200, await opMembers(m));
      case "task.update":   return resp(200, await opTaskUpdate(m, p));
      case "task.create":   return resp(200, await opTaskCreate(m, p));
      case "task.comment":  return resp(200, await opTaskComment(m, p));
      case "task.watch":    return resp(200, await opTaskWatch(m, p));
      case "leaderboard":   return resp(200, await opLeaderboard(m));
      case "trend":         return resp(200, await opTrend(m));
      default:
        return resp(404, { error: "unknown_op", op });
    }
  } catch (e) {
    log.error("webapp-api error", { op, err: e instanceof Error ? e.message : String(e) });
    return resp(500, { error: "server_error", message: e instanceof Error ? e.message : String(e) });
  }
};

// ---------- ops ----------

type Mem = { workspaceId: number; userId: number };
async function opMe(m: Mem, tg: { id: number }) {
  const ws = await db().select({ id: schema.workspaces.id, name: schema.workspaces.name, locale: schema.workspaces.locale, timezone: schema.workspaces.timezone })
    .from(schema.workspaces).where(eq(schema.workspaces.id, m.workspaceId)).limit(1);
  const u = await db().select({
    firstName: schema.users.firstName, lastName: schema.users.lastName,
    username: schema.users.telegramUsername, languageCode: schema.users.languageCode,
  }).from(schema.users).where(eq(schema.users.id, m.userId)).limit(1);
  return { membership: m, tgUser: tg, workspace: ws[0] ?? null, user: u[0] ?? null };
}

async function opStats(m: { workspaceId: number; userId: number }) {
  const wsId = m.workspaceId;
  const userId = m.userId;
  const [byStatus, byPriority, openCount, doneCount, doneWeek, overdueCount, totalLogged, weekly] = await Promise.all([
    db().select({ status: schema.tasks.status, n: sql<number>`count(*)::int` })
      .from(schema.tasks).where(eq(schema.tasks.workspaceId, wsId)).groupBy(schema.tasks.status),
    db().select({ priority: schema.tasks.priority, n: sql<number>`count(*)::int` })
      .from(schema.tasks).where(eq(schema.tasks.workspaceId, wsId)).groupBy(schema.tasks.priority),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId), sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`)),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId), eq(schema.tasks.status, "done"))),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId), eq(schema.tasks.status, "done"), sql`${schema.tasks.completedAt} >= NOW() - INTERVAL '7 days'`)),
    db().select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId), sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`, sql`${schema.tasks.dueAt} < NOW()`)),
    db().select({ n: sql<number>`COALESCE(SUM(${schema.tasks.actualMinutes}),0)::int` })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(eq(schema.tasks.workspaceId, wsId), eq(schema.taskAssignees.userId, userId))),
    db().execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM tasks WHERE workspace_id = ${wsId} AND created_at >= NOW() - INTERVAL '14 days'
      GROUP BY day ORDER BY day ASC`),
  ]);
  return {
    byStatus, byPriority,
    me: {
      open: openCount[0]?.n ?? 0,
      done: doneCount[0]?.n ?? 0,
      doneThisWeek: doneWeek[0]?.n ?? 0,
      overdue: overdueCount[0]?.n ?? 0,
      loggedMinutes: Number(totalLogged[0]?.n ?? 0),
    },
    weekly: weekly as unknown as { day: string; n: number }[],
  };
}

async function opLeaderboard(m: { workspaceId: number }) {
  const rows = await db().execute(sql`
    SELECT u.id AS user_id,
           COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS name,
           u.telegram_username AS username,
           SUM(CASE WHEN t.status = 'done' AND t.completed_at >= NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END)::int AS done14,
           SUM(CASE WHEN t.status NOT IN ('done','cancelled','archived','rejected') THEN 1 ELSE 0 END)::int AS open_count
    FROM users u
    INNER JOIN memberships ms ON ms.user_id = u.id AND ms.workspace_id = ${m.workspaceId} AND ms.active = true
    LEFT JOIN task_assignees ta ON ta.user_id = u.id
    LEFT JOIN tasks t ON t.id = ta.task_id AND t.workspace_id = ${m.workspaceId}
    GROUP BY u.id
    ORDER BY done14 DESC, open_count DESC
    LIMIT 10
  `);
  return { rows };
}

async function opTrend(m: { workspaceId: number }) {
  const rows = await db().execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done,
           SUM(CASE WHEN status NOT IN ('done','cancelled','archived','rejected') THEN 1 ELSE 0 END)::int AS open_count
    FROM tasks WHERE workspace_id = ${m.workspaceId} AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day ORDER BY day ASC
  `);
  return { rows };
}

async function opTasks(m: { workspaceId: number; userId: number }, p: Record<string, unknown>) {
  const filter = String(p.filter ?? "all"); // all | mine | watching | done
  const projectId = p.projectId != null ? Number(p.projectId) : null;
  const status = p.status as string | undefined;
  const limit = Math.min(100, Number(p.limit ?? 50));
  const offset = Number(p.offset ?? 0);

  let q = db().select({
    id: schema.tasks.id, title: schema.tasks.title, description: schema.tasks.description,
    status: schema.tasks.status, priority: schema.tasks.priority,
    dueAt: schema.tasks.dueAt, projectId: schema.tasks.projectId, parentId: schema.tasks.parentId,
    actualMinutes: schema.tasks.actualMinutes, createdAt: schema.tasks.createdAt,
  }).from(schema.tasks).$dynamic();

  const conds: ReturnType<typeof eq>[] = [eq(schema.tasks.workspaceId, m.workspaceId)];
  if (projectId) conds.push(eq(schema.tasks.projectId, projectId));
  if (status) conds.push(eq(schema.tasks.status, status as "open"));

  if (filter === "mine") {
    q = q.innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskAssignees.userId, m.userId)));
  } else if (filter === "watching") {
    q = q.innerJoin(schema.taskWatchers, eq(schema.taskWatchers.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskWatchers.userId, m.userId)));
  } else if (filter === "done") {
    q = q.where(and(...conds, eq(schema.tasks.status, "done")));
  } else {
    q = q.where(and(...conds));
  }

  const rows = await q.orderBy(desc(schema.tasks.updatedAt)).limit(limit).offset(offset);

  // Attach assignee usernames in one query
  const ids = rows.map((r) => r.id);
  const assignees = ids.length
    ? await db()
        .select({
          taskId: schema.taskAssignees.taskId,
          userId: schema.users.id,
          first: schema.users.firstName,
          last: schema.users.lastName,
          uname: schema.users.telegramUsername,
        })
        .from(schema.taskAssignees)
        .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
        .where(inArray(schema.taskAssignees.taskId, ids))
    : [];

  const byTask = new Map<number, { name: string; userId: number }[]>();
  for (const a of assignees) {
    const name = [a.first, a.last].filter(Boolean).join(" ") || (a.uname ? `@${a.uname}` : `user#${a.userId}`);
    const list = byTask.get(a.taskId) ?? [];
    list.push({ name, userId: a.userId });
    byTask.set(a.taskId, list);
  }

  return {
    rows: rows.map((r) => ({ ...r, assignees: byTask.get(r.id) ?? [] })),
  };
}

async function opTask(m: { workspaceId: number; userId: number }, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const tk = await db().select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
  if (!tk[0]) throw new Error("not_found");

  const [assignees, subtasks, comments, project, watching] = await Promise.all([
    db().select({
      userId: schema.users.id, first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
    }).from(schema.taskAssignees).innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId)).where(eq(schema.taskAssignees.taskId, id)),
    db().select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status })
      .from(schema.tasks).where(and(eq(schema.tasks.parentId, id), eq(schema.tasks.workspaceId, m.workspaceId))),
    db().select({
      id: schema.comments.id, body: schema.comments.body, createdAt: schema.comments.createdAt,
      first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
    }).from(schema.comments).innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
      .where(eq(schema.comments.taskId, id)).orderBy(asc(schema.comments.createdAt)).limit(50),
    tk[0].projectId
      ? db().select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, tk[0].projectId)).limit(1)
      : Promise.resolve([]),
    db().select({ taskId: schema.taskWatchers.taskId }).from(schema.taskWatchers)
      .where(and(eq(schema.taskWatchers.taskId, id), eq(schema.taskWatchers.userId, m.userId))).limit(1),
  ]);

  return {
    task: tk[0],
    assignees: assignees.map((a) => ({
      userId: a.userId,
      name: [a.first, a.last].filter(Boolean).join(" ") || (a.uname ? `@${a.uname}` : `user#${a.userId}`),
    })),
    subtasks,
    comments: comments.map((c) => ({
      id: c.id, body: c.body, createdAt: c.createdAt,
      author: [c.first, c.last].filter(Boolean).join(" ") || (c.uname ? `@${c.uname}` : "user"),
    })),
    project: project[0] ?? null,
    watching: !!watching[0],
  };
}

async function opKanban(m: { workspaceId: number; userId: number }) {
  // Just return active tasks grouped client-side; server returns flat list with status.
  const rows = await db().select({
    id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status,
    priority: schema.tasks.priority, dueAt: schema.tasks.dueAt,
  }).from(schema.tasks)
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId), inArray(schema.tasks.status, ["open", "assigned", "in_progress", "blocked", "in_review", "done"])))
    .orderBy(asc(schema.tasks.priority), desc(schema.tasks.updatedAt))
    .limit(200);
  return { rows };
}

async function opProjects(m: { workspaceId: number }) {
  const rows = await db().select({
    id: schema.projects.id, name: schema.projects.name, description: schema.projects.description,
  }).from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, m.workspaceId), eq(schema.projects.archived, false)))
    .orderBy(schema.projects.name);
  return { rows };
}

async function opMembers(m: { workspaceId: number }) {
  const rows = await db().select({
    id: schema.users.id, first: schema.users.firstName, last: schema.users.lastName,
    uname: schema.users.telegramUsername, role: schema.memberships.role,
  }).from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.workspaceId, m.workspaceId), eq(schema.memberships.active, true)));
  return {
    rows: rows.map((r) => ({
      id: r.id,
      role: r.role,
      name: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : `user#${r.id}`),
      username: r.uname,
    })),
  };
}

async function opQuestions(m: { workspaceId: number }) {
  const rows = await db().select({
    id: schema.questions.id, body: schema.questions.body, createdAt: schema.questions.createdAt,
    resolvedAt: schema.questions.resolvedAt,
    askerFirst: schema.users.firstName, askerLast: schema.users.lastName, askerUname: schema.users.telegramUsername,
  })
    .from(schema.questions)
    .innerJoin(schema.users, eq(schema.users.id, schema.questions.askerId))
    .where(eq(schema.questions.workspaceId, m.workspaceId))
    .orderBy(desc(schema.questions.createdAt))
    .limit(50);
  // Answer counts
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db().select({ qid: schema.answers.questionId, n: sql<number>`count(*)::int` })
        .from(schema.answers).where(inArray(schema.answers.questionId, ids)).groupBy(schema.answers.questionId)
    : [];
  const cmap = new Map(counts.map((c) => [c.qid, c.n]));
  return {
    rows: rows.map((r) => ({
      id: r.id, body: r.body, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
      asker: [r.askerFirst, r.askerLast].filter(Boolean).join(" ") || (r.askerUname ? `@${r.askerUname}` : "user"),
      answerCount: cmap.get(r.id) ?? 0,
    })),
  };
}

async function opTaskUpdate(m: { workspaceId: number; userId: number }, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof p.status === "string") patch.status = p.status;
  if (typeof p.priority === "string") patch.priority = p.priority;
  if (typeof p.title === "string") patch.title = String(p.title).slice(0, 200);
  if (typeof p.description === "string") patch.description = String(p.description).slice(0, 4000);
  if (typeof p.dueAt === "string" || p.dueAt === null) patch.dueAt = p.dueAt ? new Date(p.dueAt as string) : null;
  if (p.status === "done") patch.completedAt = new Date();

  const updated = await db().update(schema.tasks).set(patch as never)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId))).returning({ id: schema.tasks.id });
  if (!updated[0]) throw new Error("not_found");
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: id, diff: patch });
  return { ok: true };
}

async function opTaskCreate(m: { workspaceId: number; userId: number }, p: Record<string, unknown>) {
  const title = String(p.title ?? "").slice(0, 200);
  if (!title) throw new Error("title_required");
  const priority = (p.priority as "p0" | "p1" | "p2" | "p3" | undefined) ?? "p2";
  const projectId = p.projectId != null ? Number(p.projectId) : null;
  const assigneeId = p.assigneeId != null ? Number(p.assigneeId) : null;
  const dueAt = p.dueAt ? new Date(String(p.dueAt)) : null;

  const [task] = await db().insert(schema.tasks).values({
    workspaceId: m.workspaceId, creatorId: m.userId, title,
    description: typeof p.description === "string" ? String(p.description).slice(0, 4000) : null,
    priority, projectId, dueAt, status: assigneeId ? "assigned" : "open",
  }).returning({ id: schema.tasks.id });
  if (assigneeId) {
    await db().insert(schema.taskAssignees).values({ taskId: task!.id, userId: assigneeId }).onConflictDoNothing();
  }
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "task", entityId: task!.id, diff: { title, priority, projectId, assigneeId } });
  return { id: task!.id };
}

async function opTaskComment(m: { workspaceId: number; userId: number }, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const body = String(p.body ?? "").slice(0, 4000);
  if (!Number.isInteger(taskId) || !body) throw new Error("bad input");
  await db().insert(schema.comments).values({ taskId, authorId: m.userId, body });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "comment", entity: "task", entityId: taskId });
  return { ok: true };
}

async function opTaskWatch(m: { userId: number }, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const on = !!p.on;
  if (!Number.isInteger(taskId)) throw new Error("bad id");
  if (on) {
    await db().insert(schema.taskWatchers).values({ taskId, userId: m.userId }).onConflictDoNothing();
  } else {
    await db().delete(schema.taskWatchers).where(and(eq(schema.taskWatchers.taskId, taskId), eq(schema.taskWatchers.userId, m.userId)));
  }
  return { ok: true, on };
}

// ---------- helpers ----------

function resp(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(data),
  };
}

// keep imports valid for tools
export type _ = typeof isNull;
