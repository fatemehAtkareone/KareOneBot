import type { Context } from "grammy";

export interface ChatScope {
  isPrivate: boolean;
  isGroup: boolean;
  isForumTopic: boolean;
  threadId?: number;
}

export function chatScope(ctx: Context): ChatScope {
  const c = ctx.chat;
  if (!c) return { isPrivate: true, isGroup: false, isForumTopic: false };
  const isPrivate = c.type === "private";
  const isGroup = c.type === "group" || c.type === "supergroup";
  const threadId = (ctx.message as { message_thread_id?: number } | undefined)?.message_thread_id;
  return {
    isPrivate,
    isGroup,
    isForumTopic: !!threadId,
    threadId,
  };
}
