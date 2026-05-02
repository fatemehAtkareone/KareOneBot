import type { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMembershipByTelegramId } from "@/lib/rbac";
import { settingsKb, languagePickerKb, notifKb, quietHoursKb } from "@/lib/keyboards";
import { invalidateLang, userLang } from "@/lib/locale";
import { t } from "@/i18n";

export async function handleSettings(ctx: Context) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  await replyOrEdit(ctx, t(lc, "settings_title"), {
    reply_markup: { inline_keyboard: settingsKb(lc) },
  });
}

export async function handleSettingsCallback(ctx: Context, parts: string[]) {
  const tg = ctx.from!;
  const lc = await userLang(tg.id, tg.language_code);
  const verb = parts[0];
  await ctx.answerCallbackQuery().catch(() => {});

  if (verb === "close") {
    try { await ctx.editMessageText(t(lc, "closed")); } catch { /* noop */ }
    return;
  }
  if (verb === "menu") {
    const sub = parts[1];
    if (sub === "root") return handleSettings(ctx);
    if (sub === "lang") {
      return replyOrEdit(ctx, t(lc, "set_lang_title"), { reply_markup: { inline_keyboard: languagePickerKb(lc) } });
    }
    if (sub === "notif") {
      const m = await getMembershipByTelegramId(tg.id);
      if (!m) return;
      const prefs = await loadPrefs(m.userId, m.workspaceId);
      return replyOrEdit(ctx, t(lc, "set_notif_title"), { reply_markup: { inline_keyboard: notifKb(lc, prefs) } });
    }
    if (sub === "quiet") {
      return replyOrEdit(ctx, t(lc, "set_quiet_title"), { reply_markup: { inline_keyboard: quietHoursKb(lc) } });
    }
    if (sub === "tz") {
      return replyOrEdit(ctx, t(lc, "set_tz_admin_only"));
    }
    return;
  }
  if (verb === "notif") {
    const what = parts[1];
    const m = await getMembershipByTelegramId(tg.id);
    if (!m) return;
    if (what === "digest") {
      const prefs = await loadPrefs(m.userId, m.workspaceId);
      const next = !prefs.digestEnabled;
      await upsertPrefs(m.userId, m.workspaceId, { digestEnabled: next });
      const updated = await loadPrefs(m.userId, m.workspaceId);
      return replyOrEdit(ctx, t(lc, "set_notif_digest_state", { state: updated.digestEnabled ? "ON" : "OFF" }), {
        reply_markup: { inline_keyboard: notifKb(lc, updated) },
      });
    }
  }
  if (verb === "quiet") {
    const range = parts[1];
    const m = await getMembershipByTelegramId(tg.id);
    if (!m) return;
    if (range === "off") {
      await upsertPrefs(m.userId, m.workspaceId, { quietStart: null, quietEnd: null });
      return replyOrEdit(ctx, t(lc, "set_quiet_disabled"), { reply_markup: { inline_keyboard: quietHoursKb(lc) } });
    }
    const m2 = range?.match(/^(\d{2})-(\d{2})$/);
    if (!m2) return;
    await upsertPrefs(m.userId, m.workspaceId, { quietStart: `${m2[1]}:00`, quietEnd: `${m2[2]}:00` });
    return replyOrEdit(ctx, t(lc, "set_quiet_set", { start: `${m2[1]}:00`, end: `${m2[2]}:00` }), {
      reply_markup: { inline_keyboard: quietHoursKb(lc) },
    });
  }
}

async function loadPrefs(userId: number, workspaceId: number) {
  const r = await db().select().from(schema.notificationPrefs)
    .where(and(eq(schema.notificationPrefs.userId, userId), eq(schema.notificationPrefs.workspaceId, workspaceId)))
    .limit(1);
  if (r[0]) return { digestEnabled: r[0].digestEnabled, quietStart: r[0].quietStart, quietEnd: r[0].quietEnd };
  return { digestEnabled: true, quietStart: null as string | null, quietEnd: null as string | null };
}

async function upsertPrefs(
  userId: number, workspaceId: number,
  patch: Partial<{ digestEnabled: boolean; quietStart: string | null; quietEnd: string | null }>
) {
  const existing = await db().select().from(schema.notificationPrefs)
    .where(and(eq(schema.notificationPrefs.userId, userId), eq(schema.notificationPrefs.workspaceId, workspaceId)))
    .limit(1);
  if (existing[0]) {
    await db().update(schema.notificationPrefs).set(patch)
      .where(and(eq(schema.notificationPrefs.userId, userId), eq(schema.notificationPrefs.workspaceId, workspaceId)));
  } else {
    await db().insert(schema.notificationPrefs).values({
      userId, workspaceId,
      digestEnabled: patch.digestEnabled ?? true,
      quietStart: patch.quietStart ?? null,
      quietEnd: patch.quietEnd ?? null,
      eventMatrix: {},
    });
  }
  invalidateLang(userId);
}

async function replyOrEdit(ctx: Context, text: string, extra?: Record<string, unknown>) {
  const opts = { parse_mode: "HTML" as const, ...extra };
  if (ctx.callbackQuery?.message) {
    try { await ctx.editMessageText(text, opts); return; } catch { /* noop */ }
  }
  await ctx.reply(text, opts);
}
