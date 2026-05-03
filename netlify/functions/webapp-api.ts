import type { Handler } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { and, eq, sql, desc, asc, inArray, isNull, isNotNull, lte, gte, lt, ne, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, schema } from "@/lib/db";
import { authenticate } from "@/lib/webapp-auth";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { getSlaTarget, setSlaTarget, defaults as slaDefaults, type Priority } from "@/lib/sla";
import { redis } from "@/lib/redis";
import { sendMessage, h } from "@/lib/telegram";
import { log } from "@/lib/logger";

const TZ = "Asia/Tehran";
type Mem = { workspaceId: number; userId: number; role: string };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { error: "method_not_allowed" });
  let body: { initData?: string; op?: string; params?: Record<string, unknown> };
  try { body = JSON.parse(event.body ?? "{}"); } catch { return resp(400, { error: "bad_json" }); }
  const initData = body.initData ?? "";
  const op = body.op ?? "";
  const p = (body.params ?? {}) as Record<string, unknown>;

  const session = await authenticate(initData);
  if (!session) return resp(401, { error: "unauthorized" });
  const m: Mem = session.membership as Mem;
  const tg = session.tgUser;

  try {
    switch (op) {
      // ----- read -----
      case "me":             return resp(200, await opMe(m, tg));
      case "stats":          return resp(200, await opStats(m));
      case "tasks":          return resp(200, await opTasks(m, p));
      case "task":           return resp(200, await opTask(m, p));
      case "kanban":         return resp(200, await opKanban(m));
      case "projects":       return resp(200, await opProjects(m));
      case "questions":      return resp(200, await opQuestions(m));
      case "question":       return resp(200, await opQuestion(m, p));
      case "members":        return resp(200, await opMembers(m));
      case "leaderboard":    return resp(200, await opLeaderboard(m));
      case "trend":          return resp(200, await opTrend(m));
      case "find":           return resp(200, await opFind(m, p));
      case "kb":             return resp(200, await opKb(m, p));
      case "history":        return resp(200, await opHistory(m, p));
      case "history.workspace": return resp(200, await opHistoryWorkspace(m));
      case "approvals":      return resp(200, await opApprovals(m));
      case "approval":       return resp(200, await opApproval(m, p));
      case "sla.list":       return resp(200, await opSlaList(m));
      case "settings.get":   return resp(200, await opSettingsGet(m));
      case "invites":        return resp(200, await opInvites(m));
      case "timers":         return resp(200, await opTimers(m));

      // ----- write -----
      case "task.update":    return resp(200, await opTaskUpdate(m, p));
      case "task.create":    return resp(200, await opTaskCreate(m, p));
      case "task.comment":   return resp(200, await opTaskComment(m, p));
      case "task.watch":     return resp(200, await opTaskWatch(m, p));
      case "task.subtask":   return resp(200, await opTaskSubtask(m, p));
      case "task.snooze":    return resp(200, await opTaskSnooze(m, p));
      case "task.reschedule":return resp(200, await opTaskReschedule(m, p));
      case "task.assignee":  return resp(200, await opTaskAssignee(m, p));
      case "task.timer":     return resp(200, await opTaskTimer(m, p));
      case "project.create": return resp(200, await opProjectCreate(m, p));
      case "project.update": return resp(200, await opProjectUpdate(m, p));
      case "project.archive":return resp(200, await opProjectArchive(m, p));
      case "question.create":return resp(200, await opQuestionCreate(m, p, tg));
      case "answer.create":  return resp(200, await opAnswerCreate(m, p, tg));
      case "answer.upvote":  return resp(200, await opAnswerUpvote(m, p));
      case "answer.official":return resp(200, await opAnswerOfficial(m, p));
      case "approval.create":return resp(200, await opApprovalCreate(m, p, tg));
      case "approval.decide":return resp(200, await opApprovalDecide(m, p));
      case "sla.set":        return resp(200, await opSlaSet(m, p));
      case "settings.update":return resp(200, await opSettingsUpdate(m, p));
      case "invite.create":  return resp(200, await opInviteCreate(m, p));
      case "member.update":  return resp(200, await opMemberUpdate(m, p));

      default:
        return resp(404, { error: "unknown_op", op });
    }
  } catch (e) {
    log.error("webapp-api error", { op, err: e instanceof Error ? e.message : String(e) });
    return resp(500, { error: "server_error", message: e instanceof Error ? e.message : String(e) });
  }
};

// ===================================================================
// READ OPS
// ===================================================================

async function opMe(m: Mem, tg: { id: number }) {
  const ws = await db().select({ id: schema.workspaces.id, name: schema.workspaces.name, locale: schema.workspaces.locale, timezone: schema.workspaces.timezone })
    .from(schema.workspaces).where(eq(schema.workspaces.id, m.workspaceId)).limit(1);
  const u = await db().select({
    firstName: schema.users.firstName, lastName: schema.users.lastName,
    username: schema.users.telegramUsername, languageCode: schema.users.languageCode,
  }).from(schema.users).where(eq(schema.users.id, m.userId)).limit(1);
  return { membership: m, tgUser: tg, workspace: ws[0] ?? null, user: u[0] ?? null };
}

async function opStats(m: Mem) {
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

async function opLeaderboard(m: Mem) {
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

async function opTrend(m: Mem) {
  const rows = await db().execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done,
           SUM(CASE WHEN status NOT IN ('done','cancelled','archived','rejected') THEN 1 ELSE 0 END)::int AS open_count
    FROM tasks WHERE workspace_id = ${m.workspaceId} AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day ORDER BY day ASC
  `);
  return { rows };
}

async function opTasks(m: Mem, p: Record<string, unknown>) {
  const filter = String(p.filter ?? "all");
  const projectId = p.projectId != null ? Number(p.projectId) : null;
  const status = p.status as string | undefined;
  const search = p.search ? String(p.search).trim() : "";
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
  if (search) {
    const like = `%${search.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`(${schema.tasks.title} ILIKE ${like} OR COALESCE(${schema.tasks.description}, '') ILIKE ${like})` as never);
  }

  if (filter === "mine") {
    q = q.innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskAssignees.userId, m.userId)));
  } else if (filter === "watching") {
    q = q.innerJoin(schema.taskWatchers, eq(schema.taskWatchers.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskWatchers.userId, m.userId)));
  } else if (filter === "done") {
    q = q.where(and(...conds, eq(schema.tasks.status, "done")));
  } else if (filter === "overdue") {
    q = q.innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskAssignees.userId, m.userId), sql`${schema.tasks.status} NOT IN ('done','cancelled','archived','rejected')`, sql`${schema.tasks.dueAt} < NOW()`));
  } else {
    q = q.where(and(...conds));
  }

  const rows = await q.orderBy(desc(schema.tasks.updatedAt)).limit(limit).offset(offset);
  const ids = rows.map((r) => r.id);
  const assignees = ids.length
    ? await db()
        .select({ taskId: schema.taskAssignees.taskId, userId: schema.users.id, first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
        .from(schema.taskAssignees).innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
        .where(inArray(schema.taskAssignees.taskId, ids))
    : [];
  const byTask = new Map<number, { name: string; userId: number }[]>();
  for (const a of assignees) {
    const name = [a.first, a.last].filter(Boolean).join(" ") || (a.uname ? `@${a.uname}` : `user#${a.userId}`);
    const list = byTask.get(a.taskId) ?? [];
    list.push({ name, userId: a.userId });
    byTask.set(a.taskId, list);
  }
  return { rows: rows.map((r) => ({ ...r, assignees: byTask.get(r.id) ?? [] })) };
}

async function opTask(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const tk = await db().select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
  if (!tk[0]) throw new Error("not_found");

  const [assignees, subtasks, comments, project, watching, timer] = await Promise.all([
    db().select({ userId: schema.users.id, first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername })
      .from(schema.taskAssignees).innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
      .where(eq(schema.taskAssignees.taskId, id)),
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
    (async () => {
      const r = redis();
      if (!r) return null;
      const v = await r.get<number>(`timer:${m.userId}:${id}`);
      return v ? Number(v) : null;
    })(),
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
    timerStartedAt: timer,
  };
}

async function opKanban(m: Mem) {
  const rows = await db().select({
    id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status,
    priority: schema.tasks.priority, dueAt: schema.tasks.dueAt,
  }).from(schema.tasks)
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId), inArray(schema.tasks.status, ["open", "assigned", "in_progress", "blocked", "in_review", "done"])))
    .orderBy(asc(schema.tasks.priority), desc(schema.tasks.updatedAt))
    .limit(200);
  return { rows };
}

async function opProjects(m: Mem) {
  const rows = await db().select({
    id: schema.projects.id, name: schema.projects.name, description: schema.projects.description,
    archived: schema.projects.archived, createdAt: schema.projects.createdAt,
  }).from(schema.projects).where(eq(schema.projects.workspaceId, m.workspaceId)).orderBy(schema.projects.name);
  // Counts per project
  const counts = await db().execute(sql`
    SELECT project_id, count(*)::int AS total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done
    FROM tasks WHERE workspace_id = ${m.workspaceId} AND project_id IS NOT NULL
    GROUP BY project_id
  `);
  const cmap = new Map((counts as unknown as { project_id: number; total: number; done: number }[]).map((c) => [c.project_id, c]));
  return {
    rows: rows.map((r) => ({
      ...r,
      total: cmap.get(r.id)?.total ?? 0,
      done: cmap.get(r.id)?.done ?? 0,
    })),
  };
}

async function opMembers(m: Mem) {
  const rows = await db().select({
    id: schema.users.id, first: schema.users.firstName, last: schema.users.lastName,
    uname: schema.users.telegramUsername, role: schema.memberships.role, active: schema.memberships.active,
    membershipId: schema.memberships.id,
  }).from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.memberships.workspaceId, m.workspaceId))
    .orderBy(schema.users.firstName);
  // Counts per member
  const counts = await db().execute(sql`
    SELECT ta.user_id, count(*)::int AS open_count,
      SUM(CASE WHEN t.status = 'done' AND t.completed_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS done30
    FROM task_assignees ta
    INNER JOIN tasks t ON t.id = ta.task_id AND t.workspace_id = ${m.workspaceId}
    WHERE t.status NOT IN ('done','cancelled','archived','rejected')
    GROUP BY ta.user_id
  `);
  const cmap = new Map((counts as unknown as { user_id: number; open_count: number; done30: number }[]).map((c) => [c.user_id, c]));
  return {
    rows: rows.map((r) => ({
      id: r.id, role: r.role, active: r.active, membershipId: r.membershipId,
      name: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : `user#${r.id}`),
      username: r.uname,
      openCount: cmap.get(r.id)?.open_count ?? 0,
      done30: cmap.get(r.id)?.done30 ?? 0,
    })),
  };
}

async function opQuestions(m: Mem) {
  const rows = await db().select({
    id: schema.questions.id, body: schema.questions.body, createdAt: schema.questions.createdAt,
    resolvedAt: schema.questions.resolvedAt, anonymous: schema.questions.anonymous,
    askerId: schema.questions.askerId, targetTag: schema.questions.targetTag,
    askerFirst: schema.users.firstName, askerLast: schema.users.lastName, askerUname: schema.users.telegramUsername,
  })
    .from(schema.questions)
    .innerJoin(schema.users, eq(schema.users.id, schema.questions.askerId))
    .where(eq(schema.questions.workspaceId, m.workspaceId))
    .orderBy(desc(schema.questions.createdAt))
    .limit(80);
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db().select({ qid: schema.answers.questionId, n: sql<number>`count(*)::int` })
        .from(schema.answers).where(inArray(schema.answers.questionId, ids)).groupBy(schema.answers.questionId)
    : [];
  const cmap = new Map(counts.map((c) => [c.qid, c.n]));
  return {
    rows: rows.map((r) => ({
      id: r.id, body: r.body, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
      anonymous: r.anonymous, askerId: r.askerId,
      asker: r.anonymous ? "Anonymous" : ([r.askerFirst, r.askerLast].filter(Boolean).join(" ") || (r.askerUname ? `@${r.askerUname}` : "user")),
      targetTag: r.targetTag,
      answerCount: cmap.get(r.id) ?? 0,
    })),
  };
}

async function opQuestion(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const q = await db().select({
    id: schema.questions.id, body: schema.questions.body, createdAt: schema.questions.createdAt,
    resolvedAt: schema.questions.resolvedAt, anonymous: schema.questions.anonymous, askerId: schema.questions.askerId,
    askerFirst: schema.users.firstName, askerLast: schema.users.lastName, askerUname: schema.users.telegramUsername,
  })
    .from(schema.questions).innerJoin(schema.users, eq(schema.users.id, schema.questions.askerId))
    .where(and(eq(schema.questions.id, id), eq(schema.questions.workspaceId, m.workspaceId))).limit(1);
  if (!q[0]) throw new Error("not_found");
  const answers = await db().select({
    id: schema.answers.id, body: schema.answers.body, createdAt: schema.answers.createdAt,
    isOfficial: schema.answers.isOfficial, upvotes: schema.answers.upvotes, authorId: schema.answers.authorId,
    first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
  })
    .from(schema.answers).innerJoin(schema.users, eq(schema.users.id, schema.answers.authorId))
    .where(eq(schema.answers.questionId, id))
    .orderBy(desc(schema.answers.isOfficial), desc(schema.answers.upvotes), asc(schema.answers.createdAt));
  return {
    question: {
      id: q[0].id, body: q[0].body, createdAt: q[0].createdAt, resolvedAt: q[0].resolvedAt,
      anonymous: q[0].anonymous, askerId: q[0].askerId,
      asker: q[0].anonymous ? "Anonymous" : ([q[0].askerFirst, q[0].askerLast].filter(Boolean).join(" ") || (q[0].askerUname ? `@${q[0].askerUname}` : "user")),
    },
    answers: answers.map((a) => ({
      id: a.id, body: a.body, createdAt: a.createdAt, isOfficial: a.isOfficial, upvotes: a.upvotes, authorId: a.authorId,
      author: [a.first, a.last].filter(Boolean).join(" ") || (a.uname ? `@${a.uname}` : "user"),
    })),
    canMarkOfficial: q[0].askerId === m.userId,
  };
}

async function opFind(m: Mem, p: Record<string, unknown>) {
  const q = String(p.q ?? "").trim();
  if (!q) return { rows: [] };
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db().select({
    id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, priority: schema.tasks.priority,
  }).from(schema.tasks)
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId),
      sql`(${schema.tasks.title} ILIKE ${like} OR COALESCE(${schema.tasks.description}, '') ILIKE ${like})`))
    .orderBy(desc(schema.tasks.updatedAt)).limit(30);
  return { rows };
}

async function opKb(m: Mem, p: Record<string, unknown>) {
  const q = String(p.q ?? "").trim();
  if (!q) return { rows: [] };
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db().select({
    qid: schema.questions.id, qbody: schema.questions.body,
    aid: schema.answers.id, abody: schema.answers.body,
    isOfficial: schema.answers.isOfficial, upvotes: schema.answers.upvotes,
  })
    .from(schema.questions).innerJoin(schema.answers, eq(schema.answers.questionId, schema.questions.id))
    .where(and(eq(schema.questions.workspaceId, m.workspaceId),
      sql`(${schema.questions.body} ILIKE ${like} OR ${schema.answers.body} ILIKE ${like})`))
    .orderBy(desc(schema.answers.isOfficial), desc(schema.answers.upvotes)).limit(20);
  return { rows };
}

async function opHistory(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const rows = await db().select({
    id: schema.auditLog.id, action: schema.auditLog.action, diff: schema.auditLog.diff, createdAt: schema.auditLog.createdAt,
    first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
  })
    .from(schema.auditLog).leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .where(and(eq(schema.auditLog.entity, "task"), eq(schema.auditLog.entityId, id)))
    .orderBy(desc(schema.auditLog.createdAt)).limit(80);
  return {
    rows: rows.map((r) => ({
      id: r.id, action: r.action, diff: r.diff, createdAt: r.createdAt,
      who: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "system"),
    })),
  };
}

async function opHistoryWorkspace(m: Mem) {
  const rows = await db().select({
    id: schema.auditLog.id, action: schema.auditLog.action, entity: schema.auditLog.entity,
    entityId: schema.auditLog.entityId, diff: schema.auditLog.diff, createdAt: schema.auditLog.createdAt,
    first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
  })
    .from(schema.auditLog).leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .where(eq(schema.auditLog.workspaceId, m.workspaceId))
    .orderBy(desc(schema.auditLog.createdAt)).limit(50);
  return {
    rows: rows.map((r) => ({
      id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, diff: r.diff, createdAt: r.createdAt,
      who: [r.first, r.last].filter(Boolean).join(" ") || (r.uname ? `@${r.uname}` : "system"),
    })),
  };
}

async function opApprovals(m: Mem) {
  // Find approvals where current user is an approver, and approvals they requested
  const incoming = await db().select({
    approvalId: schema.approvals.id, taskId: schema.approvals.taskId, type: schema.approvals.type, status: schema.approvals.status,
    requiredCount: schema.approvals.requiredCount, approvedCount: schema.approvals.approvedCount, rejectedCount: schema.approvals.rejectedCount,
    createdAt: schema.approvals.createdAt, requestedBy: schema.approvals.requestedBy,
    title: schema.tasks.title, stepId: schema.approvalSteps.id, decision: schema.approvalSteps.decision,
  })
    .from(schema.approvalSteps)
    .innerJoin(schema.approvals, eq(schema.approvals.id, schema.approvalSteps.approvalId))
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.approvals.taskId))
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId), eq(schema.approvalSteps.approverUserId, m.userId)))
    .orderBy(desc(schema.approvals.createdAt)).limit(50);

  const outgoing = await db().select({
    approvalId: schema.approvals.id, taskId: schema.approvals.taskId, type: schema.approvals.type, status: schema.approvals.status,
    requiredCount: schema.approvals.requiredCount, approvedCount: schema.approvals.approvedCount, rejectedCount: schema.approvals.rejectedCount,
    createdAt: schema.approvals.createdAt, title: schema.tasks.title,
  })
    .from(schema.approvals)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.approvals.taskId))
    .where(and(eq(schema.tasks.workspaceId, m.workspaceId), eq(schema.approvals.requestedBy, m.userId)))
    .orderBy(desc(schema.approvals.createdAt)).limit(30);

  return { incoming, outgoing };
}

async function opApproval(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  const ap = await db().select().from(schema.approvals).where(eq(schema.approvals.id, id)).limit(1);
  if (!ap[0]) throw new Error("not_found");
  const steps = await db().select({
    id: schema.approvalSteps.id, decision: schema.approvalSteps.decision, reason: schema.approvalSteps.reason,
    decidedAt: schema.approvalSteps.decidedAt, approverUserId: schema.approvalSteps.approverUserId,
    first: schema.users.firstName, last: schema.users.lastName, uname: schema.users.telegramUsername,
  })
    .from(schema.approvalSteps).innerJoin(schema.users, eq(schema.users.id, schema.approvalSteps.approverUserId))
    .where(eq(schema.approvalSteps.approvalId, id));
  return {
    approval: ap[0],
    steps: steps.map((s) => ({
      ...s,
      approver: [s.first, s.last].filter(Boolean).join(" ") || (s.uname ? `@${s.uname}` : `user#${s.approverUserId}`),
    })),
    myStep: steps.find((s) => s.approverUserId === m.userId) ?? null,
  };
}

async function opSlaList(m: Mem) {
  const priorities: Priority[] = ["p0", "p1", "p2", "p3"];
  const targets = await Promise.all(priorities.map(async (p) => ({ priority: p, target: await getSlaTarget(m.workspaceId, p) })));
  return { targets, defaults: slaDefaults() };
}

async function opSettingsGet(m: Mem) {
  const prefs = await db().select().from(schema.notificationPrefs)
    .where(and(eq(schema.notificationPrefs.userId, m.userId), eq(schema.notificationPrefs.workspaceId, m.workspaceId))).limit(1);
  const u = await db().select({ languageCode: schema.users.languageCode }).from(schema.users).where(eq(schema.users.id, m.userId)).limit(1);
  return {
    language: u[0]?.languageCode ?? "fa",
    digestEnabled: prefs[0]?.digestEnabled ?? true,
    quietStart: prefs[0]?.quietStart ?? null,
    quietEnd: prefs[0]?.quietEnd ?? null,
  };
}

async function opInvites(m: Mem) {
  const rows = await db().select({
    token: schema.inviteTokens.token, role: schema.inviteTokens.role, createdAt: schema.inviteTokens.createdAt,
    expiresAt: schema.inviteTokens.expiresAt, usedBy: schema.inviteTokens.usedBy,
  })
    .from(schema.inviteTokens).where(eq(schema.inviteTokens.workspaceId, m.workspaceId))
    .orderBy(desc(schema.inviteTokens.createdAt)).limit(20);
  return { rows };
}

async function opTimers(m: Mem) {
  const r = redis();
  if (!r) return { rows: [] };
  const keys = await r.keys(`timer:${m.userId}:*`);
  const rows: { taskId: number; startedAt: number; minutes: number; title: string }[] = [];
  for (const k of keys) {
    const taskId = Number(k.split(":").at(-1));
    const startedAt = await r.get<number>(k);
    if (!startedAt) continue;
    const tk = await db().select({ title: schema.tasks.title }).from(schema.tasks)
      .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
    if (!tk[0]) continue;
    rows.push({
      taskId, startedAt: Number(startedAt), title: tk[0].title,
      minutes: Math.floor((Date.now() - Number(startedAt)) / 60000),
    });
  }
  return { rows };
}

// ===================================================================
// WRITE OPS
// ===================================================================

async function opTaskUpdate(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof p.status === "string") patch.status = p.status;
  if (typeof p.priority === "string") patch.priority = p.priority;
  if (typeof p.title === "string") patch.title = String(p.title).slice(0, 200);
  if (typeof p.description === "string") patch.description = String(p.description).slice(0, 4000);
  if (typeof p.dueAt === "string" || p.dueAt === null) patch.dueAt = p.dueAt ? new Date(p.dueAt as string) : null;
  if (typeof p.projectId === "number" || p.projectId === null) patch.projectId = p.projectId;
  if (p.status === "done") patch.completedAt = new Date();

  const updated = await db().update(schema.tasks).set(patch as never)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, m.workspaceId))).returning({ id: schema.tasks.id });
  if (!updated[0]) throw new Error("not_found");
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: id, diff: patch });
  return { ok: true };
}

async function opTaskCreate(m: Mem, p: Record<string, unknown>) {
  const title = String(p.title ?? "").slice(0, 200);
  if (!title) throw new Error("title_required");
  const priority = (p.priority as "p0" | "p1" | "p2" | "p3" | undefined) ?? "p2";
  const projectId = p.projectId != null ? Number(p.projectId) : null;
  const assigneeId = p.assigneeId != null ? Number(p.assigneeId) : null;
  const parentId = p.parentId != null ? Number(p.parentId) : null;
  const dueAt = p.dueAt ? new Date(String(p.dueAt)) : null;

  const [task] = await db().insert(schema.tasks).values({
    workspaceId: m.workspaceId, creatorId: m.userId, title, parentId,
    description: typeof p.description === "string" ? String(p.description).slice(0, 4000) : null,
    priority, projectId, dueAt, status: assigneeId ? "assigned" : "open",
  }).returning({ id: schema.tasks.id });
  if (assigneeId) {
    await db().insert(schema.taskAssignees).values({ taskId: task!.id, userId: assigneeId }).onConflictDoNothing();
  }
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "task", entityId: task!.id, diff: { title, priority, projectId, assigneeId, parentId } });
  return { id: task!.id };
}

async function opTaskComment(m: Mem, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const body = String(p.body ?? "").slice(0, 4000);
  if (!Number.isInteger(taskId) || !body) throw new Error("bad input");
  await db().insert(schema.comments).values({ taskId, authorId: m.userId, body });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "comment", entity: "task", entityId: taskId });
  return { ok: true };
}

async function opTaskWatch(m: Mem, p: Record<string, unknown>) {
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

async function opTaskSubtask(m: Mem, p: Record<string, unknown>) {
  const parentId = Number(p.parentId);
  const title = String(p.title ?? "").slice(0, 200);
  if (!Number.isInteger(parentId) || !title) throw new Error("bad input");
  const parent = await db().select({ priority: schema.tasks.priority }).from(schema.tasks)
    .where(and(eq(schema.tasks.id, parentId), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
  if (!parent[0]) throw new Error("parent_not_found");
  const [child] = await db().insert(schema.tasks).values({
    workspaceId: m.workspaceId, creatorId: m.userId, parentId, title,
    priority: parent[0].priority, status: "open",
  }).returning({ id: schema.tasks.id });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "task", entityId: child!.id, diff: { parentId, title } });
  return { id: child!.id };
}

async function opTaskSnooze(m: Mem, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const preset = String(p.preset ?? "");
  if (!Number.isInteger(taskId)) throw new Error("bad id");
  const now = DateTime.now().setZone(TZ);
  let next: DateTime;
  switch (preset) {
    case "1h":   next = now.plus({ hours: 1 }); break;
    case "3h":   next = now.plus({ hours: 3 }); break;
    case "tom9": next = now.plus({ days: 1 }).set({ hour: 9, minute: 0 }); break;
    case "mon9": next = now.plus({ weeks: 1 }).set({ weekday: 1, hour: 9, minute: 0 }); break;
    default: throw new Error("bad preset");
  }
  await db().update(schema.tasks).set({ dueAt: next.toJSDate(), updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId)));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: taskId, diff: { snoozedTo: next.toISO() } });
  const r = redis();
  if (r) {
    await r.del(`notify:duesoon:${taskId}:${m.userId}`);
    await r.del(`notify:overdue:${taskId}:${m.userId}`);
  }
  return { ok: true, dueAt: next.toISO() };
}

async function opTaskReschedule(m: Mem, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  if (!Number.isInteger(taskId)) throw new Error("bad id");
  const dueAt = p.dueAt ? new Date(String(p.dueAt)) : null;
  await db().update(schema.tasks).set({ dueAt, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId)));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: taskId, diff: { dueAt: dueAt?.toISOString() ?? null } });
  return { ok: true };
}

async function opTaskAssignee(m: Mem, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const userId = Number(p.userId);
  const op = String(p.op ?? "set"); // set | add | remove
  if (!Number.isInteger(taskId) || !Number.isInteger(userId)) throw new Error("bad input");
  if (op === "set") {
    await db().delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, taskId));
    await db().insert(schema.taskAssignees).values({ taskId, userId });
    await db().update(schema.tasks).set({ status: "assigned", updatedAt: new Date() })
      .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId)));
  } else if (op === "add") {
    await db().insert(schema.taskAssignees).values({ taskId, userId }).onConflictDoNothing();
  } else if (op === "remove") {
    await db().delete(schema.taskAssignees).where(and(eq(schema.taskAssignees.taskId, taskId), eq(schema.taskAssignees.userId, userId)));
  }
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "assign", entity: "task", entityId: taskId, diff: { op, userId } });
  return { ok: true };
}

async function opTaskTimer(m: Mem, p: Record<string, unknown>) {
  const taskId = Number(p.id);
  const action = String(p.action ?? "");
  if (!Number.isInteger(taskId)) throw new Error("bad id");
  const r = redis();
  if (!r) throw new Error("redis_required");
  if (action === "start") {
    await r.set(`timer:${m.userId}:${taskId}`, Date.now(), { ex: 60 * 60 * 12 });
    await db().update(schema.tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
    return { ok: true, action: "start" };
  } else if (action === "stop") {
    const startedAt = await r.get<number>(`timer:${m.userId}:${taskId}`);
    if (!startedAt) return { ok: false, message: "no_timer" };
    const minutes = Math.max(1, Math.floor((Date.now() - Number(startedAt)) / 60000));
    await r.del(`timer:${m.userId}:${taskId}`);
    await db().insert(schema.comments).values({ taskId, authorId: m.userId, body: `⏱️ +${minutes} min` });
    const cur = await db().select({ actual: schema.tasks.actualMinutes }).from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
    await db().update(schema.tasks).set({ actualMinutes: (cur[0]?.actual ?? 0) + minutes, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
    await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "task", entityId: taskId, diff: { loggedMinutes: minutes } });
    return { ok: true, action: "stop", minutes };
  }
  throw new Error("bad action");
}

async function opProjectCreate(m: Mem, p: Record<string, unknown>) {
  const name = String(p.name ?? "").slice(0, 120).trim();
  if (!name) throw new Error("name_required");
  const description = typeof p.description === "string" ? String(p.description).slice(0, 500) : null;
  const [proj] = await db().insert(schema.projects).values({
    workspaceId: m.workspaceId, name, description,
  }).returning({ id: schema.projects.id });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "project", entityId: proj!.id, diff: { name } });
  return { id: proj!.id };
}

async function opProjectUpdate(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const patch: Record<string, unknown> = {};
  if (typeof p.name === "string") patch.name = String(p.name).slice(0, 120);
  if (typeof p.description === "string" || p.description === null) patch.description = p.description ? String(p.description).slice(0, 500) : null;
  await db().update(schema.projects).set(patch as never)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.workspaceId, m.workspaceId)));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "project", entityId: id, diff: patch });
  return { ok: true };
}

async function opProjectArchive(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  const archived = !!p.archived;
  if (!Number.isInteger(id)) throw new Error("bad id");
  await db().update(schema.projects).set({ archived })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.workspaceId, m.workspaceId)));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "project", entityId: id, diff: { archived } });
  return { ok: true };
}

async function opQuestionCreate(m: Mem, p: Record<string, unknown>, tg: { first_name?: string; last_name?: string; username?: string }) {
  const body = String(p.body ?? "").slice(0, 2000).trim();
  if (!body) throw new Error("body_required");
  const targetUserId = p.targetUserId != null ? Number(p.targetUserId) : null;
  const targetTag = typeof p.targetTag === "string" ? String(p.targetTag).slice(0, 40) : null;
  const anonymous = !!p.anonymous;
  const [q] = await db().insert(schema.questions).values({
    workspaceId: m.workspaceId, askerId: m.userId, body, targetUserId, targetTag, anonymous,
  }).returning({ id: schema.questions.id });
  // DM the target if specified
  if (targetUserId) {
    const u = await db().select({ telegramId: schema.users.telegramId }).from(schema.users).where(eq(schema.users.id, targetUserId)).limit(1);
    if (u[0]) {
      const who = anonymous ? "Anonymous" : ([tg.first_name, tg.last_name].filter(Boolean).join(" ") || (tg.username ? `@${tg.username}` : "user"));
      await sendMessage(u[0].telegramId, `❓ Question from <b>${h(who)}</b> (Q#${q!.id}):\n${h(body)}`).catch(() => {});
    }
  }
  return { id: q!.id };
}

async function opAnswerCreate(m: Mem, p: Record<string, unknown>, tg: { first_name?: string; last_name?: string; username?: string }) {
  const questionId = Number(p.questionId);
  const body = String(p.body ?? "").slice(0, 4000).trim();
  if (!Number.isInteger(questionId) || !body) throw new Error("bad input");
  const q = await db().select({ askerId: schema.questions.askerId, body: schema.questions.body })
    .from(schema.questions).where(and(eq(schema.questions.id, questionId), eq(schema.questions.workspaceId, m.workspaceId))).limit(1);
  if (!q[0]) throw new Error("not_found");
  await db().insert(schema.answers).values({ questionId, authorId: m.userId, body });
  // Notify asker
  const asker = await db().select({ telegramId: schema.users.telegramId }).from(schema.users).where(eq(schema.users.id, q[0].askerId)).limit(1);
  if (asker[0]) {
    const who = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || (tg.username ? `@${tg.username}` : "user");
    await sendMessage(asker[0].telegramId, `💬 New answer on Q#${questionId} from <b>${h(who)}</b>:\n${h(body.slice(0, 600))}`).catch(() => {});
  }
  return { ok: true };
}

async function opAnswerUpvote(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const exists = await db().select({ id: schema.answers.id })
    .from(schema.answers).innerJoin(schema.questions, eq(schema.questions.id, schema.answers.questionId))
    .where(and(eq(schema.answers.id, id), eq(schema.questions.workspaceId, m.workspaceId))).limit(1);
  if (!exists[0]) throw new Error("not_found");
  const updated = await db().update(schema.answers).set({ upvotes: sql`${schema.answers.upvotes} + 1` })
    .where(eq(schema.answers.id, id)).returning({ upvotes: schema.answers.upvotes });
  return { ok: true, upvotes: updated[0]?.upvotes };
}

async function opAnswerOfficial(m: Mem, p: Record<string, unknown>) {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new Error("bad id");
  const ans = await db().select({
    id: schema.answers.id, questionId: schema.answers.questionId, askerId: schema.questions.askerId,
  })
    .from(schema.answers).innerJoin(schema.questions, eq(schema.questions.id, schema.answers.questionId))
    .where(and(eq(schema.answers.id, id), eq(schema.questions.workspaceId, m.workspaceId))).limit(1);
  if (!ans[0]) throw new Error("not_found");
  if (ans[0].askerId !== m.userId) throw new Error("only_asker");
  await db().update(schema.answers).set({ isOfficial: false }).where(eq(schema.answers.questionId, ans[0].questionId));
  await db().update(schema.answers).set({ isOfficial: true }).where(eq(schema.answers.id, id));
  await db().update(schema.questions).set({ resolvedAt: new Date() }).where(eq(schema.questions.id, ans[0].questionId));
  return { ok: true };
}

async function opApprovalCreate(m: Mem, p: Record<string, unknown>, tg: { first_name?: string; last_name?: string; username?: string }) {
  const taskId = Number(p.taskId);
  const approverIds = (Array.isArray(p.approverIds) ? p.approverIds : []).map(Number).filter(Number.isInteger);
  const allMode = !!p.all;
  if (!Number.isInteger(taskId) || approverIds.length === 0) throw new Error("bad input");
  const task = await db().select({ id: schema.tasks.id, title: schema.tasks.title }).from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, m.workspaceId))).limit(1);
  if (!task[0]) throw new Error("not_found");

  const requiredCount = allMode ? approverIds.length : 1;
  const [approval] = await db().insert(schema.approvals).values({
    taskId, type: allMode ? "all" : "any", requiredCount, requestedBy: m.userId,
  }).returning({ id: schema.approvals.id });
  await db().insert(schema.approvalSteps).values(approverIds.map((id) => ({ approvalId: approval!.id, approverUserId: id })));
  await db().update(schema.tasks).set({ status: "in_review", updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "create", entity: "approval", entityId: approval!.id, diff: { taskId, type: allMode ? "all" : "any", n: approverIds.length } });

  // DM each approver
  for (const aid of approverIds) {
    const stepRow = await db().select({ id: schema.approvalSteps.id }).from(schema.approvalSteps)
      .where(and(eq(schema.approvalSteps.approvalId, approval!.id), eq(schema.approvalSteps.approverUserId, aid))).limit(1);
    const stepId = stepRow[0]?.id;
    if (!stepId) continue;
    const u = await db().select({ telegramId: schema.users.telegramId }).from(schema.users).where(eq(schema.users.id, aid)).limit(1);
    if (!u[0]) continue;
    const who = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || (tg.username ? `@${tg.username}` : "user");
    await sendMessage(u[0].telegramId,
      `🛂 <b>Approval requested</b>\nTask <b>#${taskId}</b> · ${h(task[0].title)}\nRequested by <b>${h(who)}</b>`,
      { reply_markup: { inline_keyboard: [
        [{ text: "✅ Approve", callback_data: `ap:y:${stepId}` }, { text: "❌ Reject", callback_data: `ap:n:${stepId}` }],
        [{ text: "👁️ View task", callback_data: `t:view:${taskId}` }],
      ]}}
    ).catch(() => {});
  }
  return { id: approval!.id };
}

async function opApprovalDecide(m: Mem, p: Record<string, unknown>) {
  const stepId = Number(p.stepId);
  const decision = p.decision === "approved" ? "approved" : "rejected";
  const reason = typeof p.reason === "string" ? String(p.reason).slice(0, 300) : null;
  if (!Number.isInteger(stepId)) throw new Error("bad id");
  const step = await db().select({
    id: schema.approvalSteps.id, approvalId: schema.approvalSteps.approvalId,
    approverUserId: schema.approvalSteps.approverUserId, decision: schema.approvalSteps.decision,
  }).from(schema.approvalSteps).where(eq(schema.approvalSteps.id, stepId)).limit(1);
  if (!step[0] || step[0].approverUserId !== m.userId) throw new Error("not_yours");
  if (step[0].decision !== "pending") throw new Error("already_decided");

  await db().update(schema.approvalSteps).set({ decision, reason, decidedAt: new Date() })
    .where(eq(schema.approvalSteps.id, stepId));
  // Recompute counts
  const counts = await db().select({ id: schema.approvalSteps.id, decision: schema.approvalSteps.decision })
    .from(schema.approvalSteps).where(eq(schema.approvalSteps.approvalId, step[0].approvalId));
  const approved = counts.filter((c) => c.decision === "approved").length;
  const rejected = counts.filter((c) => c.decision === "rejected").length;
  const pending = counts.filter((c) => c.decision === "pending").length;
  const ap = await db().select({
    id: schema.approvals.id, taskId: schema.approvals.taskId, type: schema.approvals.type,
  }).from(schema.approvals).where(eq(schema.approvals.id, step[0].approvalId)).limit(1);
  if (!ap[0]) throw new Error("approval_missing");
  let nextStatus: "pending" | "approved" | "rejected" = "pending";
  if (ap[0].type === "all") {
    if (rejected > 0) nextStatus = "rejected";
    else if (approved >= counts.length) nextStatus = "approved";
  } else {
    if (approved >= 1) nextStatus = "approved";
    else if (rejected >= 1 && pending === 0) nextStatus = "rejected";
  }
  await db().update(schema.approvals).set({ approvedCount: approved, rejectedCount: rejected, status: nextStatus })
    .where(eq(schema.approvals.id, step[0].approvalId));
  if (nextStatus !== "pending") {
    const newTaskStatus = nextStatus === "approved" ? "in_progress" : "rejected";
    await db().update(schema.tasks).set({ status: newTaskStatus, updatedAt: new Date() }).where(eq(schema.tasks.id, ap[0].taskId));
  }
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "approval", entityId: ap[0].id, diff: { decision, reason, status: nextStatus } });
  return { ok: true, status: nextStatus };
}

async function opSlaSet(m: Mem, p: Record<string, unknown>) {
  if (!["super_admin", "admin"].includes(m.role)) throw new Error("admin_only");
  const priority = String(p.priority ?? "") as Priority;
  const responseMinutes = Number(p.responseMinutes);
  const resolutionMinutes = Number(p.resolutionMinutes);
  if (!["p0", "p1", "p2", "p3"].includes(priority) || !Number.isFinite(responseMinutes) || !Number.isFinite(resolutionMinutes)) throw new Error("bad input");
  await setSlaTarget(m.workspaceId, priority, { responseMinutes, resolutionMinutes });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "sla_policy", diff: { priority, responseMinutes, resolutionMinutes } });
  return { ok: true };
}

async function opSettingsUpdate(m: Mem, p: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (typeof p.digestEnabled === "boolean") patch.digestEnabled = p.digestEnabled;
  if (typeof p.quietStart === "string" || p.quietStart === null) patch.quietStart = p.quietStart;
  if (typeof p.quietEnd === "string" || p.quietEnd === null) patch.quietEnd = p.quietEnd;

  if (Object.keys(patch).length > 0) {
    const existing = await db().select().from(schema.notificationPrefs)
      .where(and(eq(schema.notificationPrefs.userId, m.userId), eq(schema.notificationPrefs.workspaceId, m.workspaceId))).limit(1);
    if (existing[0]) {
      await db().update(schema.notificationPrefs).set(patch)
        .where(and(eq(schema.notificationPrefs.userId, m.userId), eq(schema.notificationPrefs.workspaceId, m.workspaceId)));
    } else {
      await db().insert(schema.notificationPrefs).values({
        userId: m.userId, workspaceId: m.workspaceId,
        digestEnabled: patch.digestEnabled === undefined ? true : (patch.digestEnabled as boolean),
        quietStart: (patch.quietStart as string | null | undefined) ?? null,
        quietEnd: (patch.quietEnd as string | null | undefined) ?? null,
        eventMatrix: {},
      });
    }
  }
  if (typeof p.language === "string" && (p.language === "fa" || p.language === "en")) {
    await db().update(schema.users).set({ languageCode: p.language }).where(eq(schema.users.id, m.userId));
  }
  return { ok: true };
}

async function opInviteCreate(m: Mem, p: Record<string, unknown>) {
  if (!["super_admin", "admin"].includes(m.role)) throw new Error("admin_only");
  const role = (p.role === "manager" || p.role === "admin" || p.role === "member" || p.role === "guest") ? p.role : "member";
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db().insert(schema.inviteTokens).values({
    token, workspaceId: m.workspaceId, role, createdBy: m.userId, expiresAt,
  });
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "invite", entity: "invite_token" });
  const link = `https://t.me/${env().TELEGRAM_BOT_USERNAME}?start=invite_${token}`;
  return { token, link, expiresAt: expiresAt.toISOString(), role };
}

async function opMemberUpdate(m: Mem, p: Record<string, unknown>) {
  if (!["super_admin", "admin"].includes(m.role)) throw new Error("admin_only");
  const membershipId = Number(p.membershipId);
  if (!Number.isInteger(membershipId)) throw new Error("bad id");
  const patch: Record<string, unknown> = {};
  if (typeof p.role === "string" && ["super_admin", "admin", "manager", "member", "guest"].includes(p.role)) patch.role = p.role;
  if (typeof p.active === "boolean") patch.active = p.active;
  await db().update(schema.memberships).set(patch as never)
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.workspaceId, m.workspaceId)));
  await audit({ workspaceId: m.workspaceId, actorId: m.userId, action: "update", entity: "membership", entityId: membershipId, diff: patch });
  return { ok: true };
}

// ===================================================================
// helpers
// ===================================================================

function resp(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(data),
  };
}

export type _Unused = typeof isNull | typeof isNotNull | typeof lte | typeof gte | typeof lt | typeof ne | typeof or;
