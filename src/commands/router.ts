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
import { getState } from "@/lib/redis";
import { t } from "@/i18n";
import { upsertUser } from "@/lib/users";
import { log } from "@/lib/logger";

type WizardState = NewTaskState;

export async function route(ctx: Context): Promise<void> {
  const tg = ctx.from;
  if (!tg) return;
  await upsertUser(tg);

  const text = ctx.message?.text?.trim() ?? ctx.callbackQuery?.data ?? "";
  const chatId = ctx.chat?.id;
  const userId = tg.id;

  // Active wizard takes precedence over plain messages (but not over /commands)
  if (chatId && !text.startsWith("/")) {
    const state = await getState<WizardState>(chatId, userId);
    if (state?.flow === "newtask") {
      await handleNewTaskWizardStep(ctx, state);
      return;
    }
  }

  if (!text.startsWith("/")) return; // ignore non-command chatter for now

  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd!.split("@")[0]!.toLowerCase(); // strip @BotName suffix

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
    case "/cancel":
    case "/skip":
      return handleCancel(ctx);
    default:
      await ctx.reply(t(ctx.from?.language_code, "unknown_command"));
  }
}
