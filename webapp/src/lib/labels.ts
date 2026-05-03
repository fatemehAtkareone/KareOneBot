export const STATUS_KEYS: Record<string, string> = {
  open: "status_open", assigned: "status_assigned", in_progress: "status_in_progress",
  blocked: "status_blocked", in_review: "status_in_review", done: "status_done",
  cancelled: "status_cancelled", rejected: "status_rejected", archived: "status_archived",
  draft: "status_draft",
};

export const STATUS_EMOJI: Record<string, string> = {
  open: "📂", assigned: "📌", in_progress: "🔧", blocked: "🛑",
  in_review: "👀", done: "✅", cancelled: "❌", rejected: "🚫", archived: "🗄️", draft: "📝",
};

export const PRIORITY_LABEL: Record<string, string> = { p0: "🔴 P0", p1: "🟠 P1", p2: "🟡 P2", p3: "🟢 P3" };
export const PRIORITY_DOT: Record<string, string> = { p0: "priority-p0", p1: "priority-p1", p2: "priority-p2", p3: "priority-p3" };

export const ROLE_BADGE: Record<string, { label: string; tone: string }> = {
  super_admin: { label: "👑 Super", tone: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  admin:       { label: "🛡️ Admin", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  manager:     { label: "🎖️ Manager", tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" },
  member:      { label: "👤 Member", tone: "bg-tg-secondaryBg text-tg-text" },
  guest:       { label: "🙋 Guest", tone: "bg-tg-secondaryBg text-tg-hint" },
};
