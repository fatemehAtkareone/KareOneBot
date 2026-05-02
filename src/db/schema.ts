import {
  pgTable,
  bigserial,
  bigint,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ----- Enums -----
export const roleEnum = pgEnum("role", [
  "super_admin",
  "admin",
  "manager",
  "member",
  "guest",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
  "rejected",
  "archived",
]);

export const priorityEnum = pgEnum("priority", ["p0", "p1", "p2", "p3"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "assign",
  "status_change",
  "comment",
  "login",
  "invite",
]);

// ----- Workspaces -----
export const workspaces = pgTable("workspaces", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tehran"),
  locale: text("locale").notNull().default("fa"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Users (one row per Telegram identity) -----
export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    telegramUsername: text("telegram_username"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    languageCode: text("language_code"),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tgIdx: uniqueIndex("users_telegram_id_idx").on(t.telegramId),
  })
);

// ----- Memberships (user × workspace × role) -----
export const memberships = pgTable(
  "memberships",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: bigint("workspace_id", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    title: text("title"),
    departmentId: bigint("department_id", { mode: "number" }),
    managerId: bigint("manager_id", { mode: "number" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("memberships_ws_user_idx").on(t.workspaceId, t.userId),
  })
);

// ----- Departments -----
export const departments = pgTable("departments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: bigint("workspace_id", { mode: "number" })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Projects -----
export const projects = pgTable("projects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: bigint("workspace_id", { mode: "number" })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Tasks -----
export const tasks = pgTable(
  "tasks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: bigint("workspace_id", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: bigint("project_id", { mode: "number" }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    parentId: bigint("parent_id", { mode: "number" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    priority: priorityEnum("priority").notNull().default("p2"),
    creatorId: bigint("creator_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startAt: timestamp("start_at", { withTimezone: true }),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes").default(0),
    recurrenceRule: text("recurrence_rule"),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    wsIdx: index("tasks_workspace_idx").on(t.workspaceId),
    statusIdx: index("tasks_status_idx").on(t.workspaceId, t.status),
    dueIdx: index("tasks_due_idx").on(t.dueAt),
  })
);

// ----- Task assignees (M:N) -----
export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: bigint("task_id", { mode: "number" })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.userId] }),
    userIdx: index("task_assignees_user_idx").on(t.userId),
  })
);

// ----- Task watchers -----
export const taskWatchers = pgTable(
  "task_watchers",
  {
    taskId: bigint("task_id", { mode: "number" })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.userId] }),
  })
);

// ----- Labels & task labels -----
export const labels = pgTable(
  "labels",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: bigint("workspace_id", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => ({
    uniq: uniqueIndex("labels_ws_name_idx").on(t.workspaceId, t.name),
  })
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: bigint("task_id", { mode: "number" })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: bigint("label_id", { mode: "number" })
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.labelId] }),
  })
);

// ----- Comments -----
export const comments = pgTable("comments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  taskId: bigint("task_id", { mode: "number" })
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: bigint("author_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Attachments -----
export const attachments = pgTable("attachments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  taskId: bigint("task_id", { mode: "number" }).references(() => tasks.id, {
    onDelete: "cascade",
  }),
  commentId: bigint("comment_id", { mode: "number" }).references(
    () => comments.id,
    { onDelete: "cascade" }
  ),
  uploaderId: bigint("uploader_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  telegramFileId: text("telegram_file_id"),
  url: text("url"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Q&A -----
export const questions = pgTable("questions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: bigint("workspace_id", { mode: "number" })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  askerId: bigint("asker_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  targetUserId: bigint("target_user_id", { mode: "number" }).references(
    () => users.id
  ),
  targetTag: text("target_tag"),
  anonymous: boolean("anonymous").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const answers = pgTable("answers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  questionId: bigint("question_id", { mode: "number" })
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  authorId: bigint("author_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  isOfficial: boolean("is_official").notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Notifications & prefs -----
export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: bigint("workspace_id", { mode: "number" }).references(
    () => workspaces.id,
    { onDelete: "cascade" }
  ),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: bigint("workspace_id", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    quietStart: text("quiet_start"),
    quietEnd: text("quiet_end"),
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    eventMatrix: jsonb("event_matrix").$type<Record<string, boolean>>().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.workspaceId] }),
  })
);

// ----- Invite tokens -----
export const inviteTokens = pgTable("invite_tokens", {
  token: text("token").primaryKey(),
  workspaceId: bigint("workspace_id", { mode: "number" })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  createdBy: bigint("created_by", { mode: "number" })
    .notNull()
    .references(() => users.id),
  usedBy: bigint("used_by", { mode: "number" }).references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Audit log -----
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: bigint("workspace_id", { mode: "number" }).references(
      () => workspaces.id,
      { onDelete: "cascade" }
    ),
    actorId: bigint("actor_id", { mode: "number" }).references(() => users.id),
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    entityId: bigint("entity_id", { mode: "number" }),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    wsIdx: index("audit_workspace_idx").on(t.workspaceId, t.createdAt),
  })
);
