import { tg } from "./tg";

const API = "/.netlify/functions/webapp-api";

export interface ApiTask {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: "p0" | "p1" | "p2" | "p3";
  dueAt: string | null;
  projectId: number | null;
  parentId: number | null;
  actualMinutes: number | null;
  createdAt: string;
  assignees?: { name: string; userId: number }[];
}

export interface ApiStats {
  byStatus: { status: string; n: number }[];
  byPriority: { priority: string; n: number }[];
  me: { open: number; done: number; doneThisWeek: number; overdue: number; loggedMinutes: number };
  weekly: { day: string; n: number }[];
}

export interface ApiTaskDetail {
  task: ApiTask;
  assignees: { userId: number; name: string }[];
  subtasks: { id: number; title: string; status: string }[];
  comments: { id: number; body: string; createdAt: string; author: string }[];
  project: { id: number; name: string } | null;
  watching: boolean;
}

export interface ApiQuestion {
  id: number; body: string; createdAt: string; resolvedAt: string | null;
  asker: string; answerCount: number;
}

export interface ApiProject { id: number; name: string; description: string | null }

export interface ApiMember { id: number; name: string; username: string | null; role: string }

export interface ApiLeaderboardRow { user_id: number; name: string; username: string | null; done14: number; open_count: number }

export interface ApiTrendRow { day: string; done: number; open_count: number }

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`${status}: ${body}`);
  }
}

export async function call<T>(op: string, params: Record<string, unknown> = {}): Promise<T> {
  const initData = tg()?.initData ?? "";
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData, op, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return (await res.json()) as T;
}
