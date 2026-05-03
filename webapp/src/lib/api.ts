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
  timerStartedAt: number | null;
}

export interface ApiQuestion {
  id: number; body: string; createdAt: string; resolvedAt: string | null;
  asker: string; answerCount: number; anonymous: boolean; askerId: number; targetTag: string | null;
}

export interface ApiQuestionDetail {
  question: { id: number; body: string; createdAt: string; resolvedAt: string | null; anonymous: boolean; askerId: number; asker: string };
  answers: { id: number; body: string; createdAt: string; isOfficial: boolean; upvotes: number; authorId: number; author: string }[];
  canMarkOfficial: boolean;
}

export interface ApiProject { id: number; name: string; description: string | null; archived: boolean; total: number; done: number; createdAt: string }

export interface ApiMember {
  id: number; name: string; username: string | null; role: string; active: boolean;
  membershipId: number; openCount: number; done30: number;
}

export interface ApiLeaderboardRow { user_id: number; name: string; username: string | null; done14: number; open_count: number }
export interface ApiTrendRow { day: string; done: number; open_count: number }

export interface ApiKbRow { qid: number; qbody: string; aid: number; abody: string; isOfficial: boolean; upvotes: number }

export interface ApiApprovalIncoming {
  approvalId: number; taskId: number; type: "any" | "all"; status: "pending" | "approved" | "rejected" | "cancelled";
  requiredCount: number; approvedCount: number; rejectedCount: number; createdAt: string;
  requestedBy: number; title: string; stepId: number; decision: "pending" | "approved" | "rejected";
}
export interface ApiApprovalOutgoing {
  approvalId: number; taskId: number; type: "any" | "all"; status: "pending" | "approved" | "rejected" | "cancelled";
  requiredCount: number; approvedCount: number; rejectedCount: number; createdAt: string; title: string;
}

export interface ApiSlaTarget { responseMinutes: number; resolutionMinutes: number }
export interface ApiSla {
  targets: { priority: "p0" | "p1" | "p2" | "p3"; target: ApiSlaTarget }[];
  defaults: Record<"p0" | "p1" | "p2" | "p3", ApiSlaTarget>;
}

export interface ApiSettings {
  language: string;
  digestEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

export interface ApiInvite {
  token: string; role: string; createdAt: string; expiresAt: string | null; usedBy: number | null;
}

export interface ApiHistoryRow {
  id: number; action: string; diff: Record<string, unknown> | null; createdAt: string; who: string;
  entity?: string; entityId?: number | null;
}

export interface ApiTimer { taskId: number; startedAt: number; minutes: number; title: string }

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
