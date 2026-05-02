import type { Context } from "grammy";
import { and, eq, lte, gte, inArray, desc, asc, SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { taskListKb } from "@/lib/keyboards";
import { t } from "@/i18n";
import { userLang } from "@/lib/locale";

const PAGE_SIZE = 8;
const OPEN = ["open", "assigned", "in_progress", "blocked", "in_review"] as const;

type Filter = "all" | "today" | "overdue" | "week" | "done" | "watching";
type Sort = "due" | "prio" | "new";

interface ListState {
  filter: Filter;
  sort: Sort;
  page: number;
}

const stateMem = new Map<string, ListState>();

function key(ctx: Context) {
  return `${ctx.chat?.id}:${ctx.from?.id}`;
}

function getOrInit(ctx: Context): ListState {
  const k = key(ctx);
  let s = stateMem.get(k);
  if (!s) {
    s = { filter: "all", sort: "due", page: 0 };
    stateMem.set(k, s);
  }
  return s;
}

export async function handleMyTasksCommand(ctx: Context) {
  stateMem.delete(key(ctx));
  await render(ctx);
}

export async function handleListCallback(ctx: Context, parts: string[]) {
  const sub = parts[0];
  const verb = parts[1];
  const value = parts[2];
  const s = getOrInit(ctx);
  if (sub !== "my") return;
  if (verb === "p") s.page = Number(value ?? 0);
  if (verb === "f") {
    s.filter = value as Filter;
    s.page = 0;
  }
  if (verb === "s") {
    s.sort = value as Sort;
    s.page = 0;
  }
  await ctx.answerCallbackQuery().catch(() => {});
  await render(ctx);
}

async function render(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const m = await getMembershipByTelegramId(tg.id);
  if (!m) {
    await replyOrEdit(ctx, t(lc, "not_member"));
    return;
  }
  const s = getOrInit(ctx);

  const conds: SQL[] = [eq(schema.tasks.workspaceId, m.workspaceId)];

  if (s.filter === "watching") {
    // join handled below
  } else if (s.filter === "done") {
    conds.push(eq(schema.tasks.status, "done"));
  } else {
    conds.push(inArray(schema.tasks.status, [...OPEN]));
  }

  const now = new Date();
  if (s.filter === "today") {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    conds.push(lte(schema.tasks.dueAt, end));
    conds.push(gte(schema.tasks.dueAt, new Date(now.getFullYear(), now.getMonth(), now.getDate())));
  }
  if (s.filter === "overdue") {
    conds.push(lte(schema.tasks.dueAt, now));
  }
  if (s.filter === "week") {
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    conds.push(lte(schema.tasks.dueAt, end));
  }

  const orderClause =
    s.sort === "prio" ? asc(schema.tasks.priority) :
    s.sort === "new" ? desc(schema.tasks.createdAt) :
    asc(schema.tasks.dueAt);

  const offset = s.page * PAGE_SIZE;
  let rows: { id: number; title: string }[];
  if (s.filter === "watching") {
    rows = await db()
      .select({ id: schema.tasks.id, title: schema.tasks.title })
      .from(schema.tasks)
      .innerJoin(schema.taskWatchers, eq(schema.taskWatchers.taskId, schema.tasks.id))
      .where(and(eq(schema.taskWatchers.userId, m.userId), eq(schema.tasks.workspaceId, m.workspaceId)))
      .orderBy(orderClause)
      .limit(PAGE_SIZE + 1)
      .offset(offset);
  } else {
    rows = await db()
      .select({ id: schema.tasks.id, title: schema.tasks.title })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .where(and(...conds, eq(schema.taskAssignees.userId, m.userId)))
      .orderBy(orderClause)
      .limit(PAGE_SIZE + 1)
      .offset(offset);
  }

  const hasNext = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  const filterLabels: Record<Filter, string> = {
    all: t(lc, "list_filter_label_all"),
    today: t(lc, "list_filter_label_today"),
    overdue: t(lc, "list_filter_label_overdue"),
    week: t(lc, "list_filter_label_week"),
    done: t(lc, "list_filter_label_done"),
    watching: t(lc, "list_filter_label_watching"),
  };
  const sortLabels: Record<Sort, string> = {
    due: t(lc, "list_sort_label_due"),
    prio: t(lc, "list_sort_label_prio"),
    new: t(lc, "list_sort_label_new"),
  };
  const header = t(lc, "list_header", { filter: filterLabels[s.filter], sort: sortLabels[s.sort] });
  const body = pageRows.length === 0 ? t(lc, "list_empty") : "";

  await replyOrEdit(ctx, header + body, {
    reply_markup: { inline_keyboard: taskListKb(lc, pageRows, s.filter, s.sort, s.page, hasNext) },
  });
}

async function replyOrEdit(ctx: Context, text: string, extra?: Record<string, unknown>) {
  const opts = { parse_mode: "HTML" as const, ...extra };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch {
      // fall through
    }
  }
  await ctx.reply(text, opts);
}
