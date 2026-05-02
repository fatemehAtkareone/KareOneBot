import type { Context } from "grammy";
import { handleStart } from "./start";
import { handleHelp } from "./help";
import { handleWhoami } from "./whoami";
import { handleNewTask, handleNewTaskWizardStep, type NewTaskState } from "./newtask";
import { handleMyTasks, handleToday, handleOverdue } from "./mytasks";
import { handleDone } from "./done";
import { handleAssign } from "./assign";
import { handleAsk } from "./ask";
import { handleInvite } from "./invite";
import { handleCancel } from "./cancel";
import { handleLang, handleLangCallback } from "./lang";
import { handleDiag } from "./diag";
import { getState } from "@/lib/redis";
import { t } from "@/i18n";
import { upsertUser } from "@/lib/users";
import { userLang, invalidateLang } from "@/lib/locale";
import { log } from "@/lib/logger";

type WizardState = NewTaskState;

export async function route(ctx: Context): Promise<void> {
  const tg = ctx.from;
  if (!tg) return;
  await upsertUser(tg);

  // Callback query: inline button taps
  if (ctx.callbackQuery?.data) {
    const data = ctx.callbackQuery.data;
    if (data === "lang:fa" || data === "lang:en") {
      const choice = data.split(":")[1] as "fa" | "en";
      await handleLangCallback(ctx, choice);
      invalidateLang(tg.id);
      return;
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  const text = ctx.message?.text?.trim() ?? "";
  const chatId = ctx.chat?.id;
  const userId = tg.id;

  // Active wizard takes precedence over plain messages (but not over /commands)
  if (chatId && text && !text.startsWith("/")) {
    const state = await getState<WizardState>(chatId, userId);
    if (state?.flow === "newtask") {
      await handleNewTaskWizardStep(ctx, state);
      return;
    }
  }

  if (!text.startsWith("/")) return;

  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd!.split("@")[0]!.toLowerCase();
  log.debug("command", { cmd, userId });

  switch (cmd) {
    case "/start":
      return handleStart(ctx, args);
    case "/help":
      return handleHelp(ctx);
    case "/whoami":
      return handleWhoami(ctx);
    case "/newtask":
    case "/task":
      return handleNewTask(ctx, args);
    case "/mytasks":
    case "/inbox":
      return handleMyTasks(ctx);
    case "/today":
      return handleToday(ctx);
    case "/overdue":
      return handleOverdue(ctx);
    case "/done":
      return handleDone(ctx, args);
    case "/assign":
      return handleAssign(ctx, args);
    case "/ask":
      return handleAsk(ctx, args);
    case "/invite":
      return handleInvite(ctx);
    case "/lang":
    case "/language":
      return handleLang(ctx, args);
    case "/diag":
      return handleDiag(ctx);
    case "/cancel":
    case "/skip":
      return handleCancel(ctx);
    default: {
      const lc = await userLang(userId, tg.language_code);
      await ctx.reply(t(lc, "unknown_command"));
    }
  }
}
