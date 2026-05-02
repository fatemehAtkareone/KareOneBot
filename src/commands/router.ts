import type { Context } from "grammy";
import { handleStart } from "./start";
import { handleHelp } from "./help";
import { handleWhoami } from "./whoami";
import { startWizard, handleCallback as wizardCallback, handleTextInput as wizardTextInput, type NewTaskWizardState } from "./task-wizard";
import { handleMyTasksCommand, handleListCallback } from "./task-list";
import { handleViewTask, handleCallback as taskCallback, consumeCommentInput, consumeSubtaskInput } from "./task-view";
import { handleDone } from "./done";
import { handleAssign } from "./assign";
import { handleAsk } from "./ask";
import { handleAnswer, consumeAnswerInput, handleListQuestions } from "./answer";
import { handleKb } from "./kb";
import { handleWork } from "./work";
import { handleInvite } from "./invite";
import { handleCancel } from "./cancel";
import { handleLang, handleLangCallback } from "./lang";
import { handleSettings, handleSettingsCallback } from "./settings";
import { handleDiag } from "./diag";
import { getState } from "@/lib/redis";
import { t } from "@/i18n";
import { upsertUser } from "@/lib/users";
import { userLang, invalidateLang } from "@/lib/locale";
import { log } from "@/lib/logger";

interface AnyState { flow: string }

export async function route(ctx: Context): Promise<void> {
  const tg = ctx.from;
  if (!tg) return;
  await upsertUser(tg);

  // ---------------- Callback queries ----------------
  if (ctx.callbackQuery?.data) {
    const data = ctx.callbackQuery.data;
    if (data === "noop") {
      await ctx.answerCallbackQuery().catch(() => {});
      return;
    }
    const [ns, ...rest] = data.split(":");
    switch (ns) {
      case "lang":
        if (rest[0] === "fa" || rest[0] === "en") {
          await handleLangCallback(ctx, rest[0]);
          invalidateLang(tg.id);
        } else {
          await ctx.answerCallbackQuery().catch(() => {});
        }
        return;
      case "nt":
        await wizardCallback(ctx, rest);
        return;
      case "t":
        await taskCallback(ctx, rest);
        return;
      case "lst":
        await handleListCallback(ctx, rest);
        return;
      case "set":
        await handleSettingsCallback(ctx, rest);
        return;
      default:
        await ctx.answerCallbackQuery().catch(() => {});
        return;
    }
  }

  const text = ctx.message?.text?.trim() ?? "";
  const chatId = ctx.chat?.id;
  const userId = tg.id;

  // ---------------- Active wizards / text-input flows ----------------
  if (chatId && text && !text.startsWith("/")) {
    const state = await getState<AnyState>(chatId, userId);
    if (state?.flow === "newtask") {
      await wizardTextInput(ctx, state as NewTaskWizardState);
      return;
    }
    if (state?.flow === "comment") {
      await consumeCommentInput(ctx, state as { flow: "comment"; taskId: number });
      return;
    }
    if (state?.flow === "subtask") {
      await consumeSubtaskInput(ctx, state as { flow: "subtask"; parentId: number });
      return;
    }
    if (state?.flow === "answer") {
      await consumeAnswerInput(ctx, state as { flow: "answer"; questionId: number });
      return;
    }
  }

  if (!text.startsWith("/")) return;

  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd!.split("@")[0]!.toLowerCase();
  log.debug("command", { cmd, userId });

  switch (cmd) {
    case "/start":          return handleStart(ctx, args);
    case "/help":           return handleHelp(ctx);
    case "/whoami":         return handleWhoami(ctx);
    case "/newtask":
    case "/new":            return startWizard(ctx);
    case "/task":           return handleViewTask(ctx, args);
    case "/mytasks":
    case "/inbox":          return handleMyTasksCommand(ctx);
    case "/today":          { const { handleToday } = await import("./mytasks"); return handleToday(ctx); }
    case "/overdue":        { const { handleOverdue } = await import("./mytasks"); return handleOverdue(ctx); }
    case "/done":           return handleDone(ctx, args);
    case "/assign":         return handleAssign(ctx, args);
    case "/ask":            return handleAsk(ctx, args);
    case "/answer":         return handleAnswer(ctx, args);
    case "/questions":      return handleListQuestions(ctx);
    case "/kb":             return handleKb(ctx, args);
    case "/work":           return handleWork(ctx, args);
    case "/invite":         return handleInvite(ctx);
    case "/settings":       return handleSettings(ctx);
    case "/lang":
    case "/language":       return handleLang(ctx, args);
    case "/diag":           return handleDiag(ctx);
    case "/cancel":
    case "/skip":           return handleCancel(ctx);
    default: {
      const lc = await userLang(userId, tg.language_code);
      await ctx.reply(t(lc, "unknown_command"));
    }
  }
}
