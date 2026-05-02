type Dict = Record<string, string>;

const en: Dict = {
  app_title: "KareOne",
  nav_dashboard: "Dashboard",
  nav_tasks: "Tasks",
  nav_kanban: "Kanban",
  nav_calendar: "Calendar",
  nav_qa: "Q&A",
  nav_more: "More",

  // Dashboard
  d_open: "Open",
  d_done_week: "Done · 7d",
  d_overdue: "Overdue",
  d_logged: "Logged",
  d_by_status: "By status",
  d_by_priority: "By priority",
  d_trend_14d: "Activity (14 days)",
  d_leaderboard: "Top performers (14d)",
  d_no_data: "No data yet",

  // Tasks
  t_all: "All",
  t_mine: "Mine",
  t_watching: "Starred",
  t_done: "Done",
  t_search: "Search…",
  t_empty: "No tasks here yet.",
  t_overdue_label: "OVERDUE",
  t_no_due: "No due date",
  t_unassigned: "Unassigned",
  t_new: "New task",
  t_subtasks: "Subtasks",
  t_comments: "Comments",
  t_add_comment: "Add a comment…",
  t_project: "Project",
  t_priority: "Priority",
  t_status: "Status",
  t_due: "Due",
  t_assignees: "Assignees",
  t_star: "Star",
  t_unstar: "Unstar",
  t_post: "Post",

  // Kanban columns
  k_open: "Open",
  k_assigned: "Assigned",
  k_in_progress: "In progress",
  k_blocked: "Blocked",
  k_in_review: "In review",
  k_done: "Done",

  // Calendar
  c_title: "Calendar",
  c_no_tasks_day: "No tasks due this day.",

  // QA
  qa_title: "Questions",
  qa_open: "Open",
  qa_resolved: "Resolved",
  qa_answers: "answers",
  qa_no_qs: "No questions yet.",

  // Common
  back: "Back",
  loading: "Loading…",
  retry: "Retry",
  error: "Something went wrong.",
  not_member: "You're not a member of any KareOne workspace yet. Use the bot first.",
  cancel: "Cancel",
  save: "Save",
};

const fa: Dict = {
  app_title: "KareOne",
  nav_dashboard: "داشبورد",
  nav_tasks: "وظایف",
  nav_kanban: "کانبان",
  nav_calendar: "تقویم",
  nav_qa: "پرسش‌ها",
  nav_more: "بیشتر",

  d_open: "باز",
  d_done_week: "انجام · ۷ روز",
  d_overdue: "عقب‌افتاده",
  d_logged: "ثبت‌شده",
  d_by_status: "بر اساس وضعیت",
  d_by_priority: "بر اساس اولویت",
  d_trend_14d: "روند ۱۴ روز اخیر",
  d_leaderboard: "برترین‌ها (۱۴ روز)",
  d_no_data: "هنوز داده‌ای نیست",

  t_all: "همه",
  t_mine: "من",
  t_watching: "ستاره‌دار",
  t_done: "انجام‌شده",
  t_search: "جست‌وجو…",
  t_empty: "هنوز وظیفه‌ای نیست.",
  t_overdue_label: "عقب‌افتاده",
  t_no_due: "بدون سررسید",
  t_unassigned: "تعیین‌نشده",
  t_new: "وظیفه جدید",
  t_subtasks: "زیروظایف",
  t_comments: "دیدگاه‌ها",
  t_add_comment: "افزودن دیدگاه…",
  t_project: "پروژه",
  t_priority: "اولویت",
  t_status: "وضعیت",
  t_due: "سررسید",
  t_assignees: "مسئولان",
  t_star: "ستاره",
  t_unstar: "حذف ستاره",
  t_post: "ارسال",

  k_open: "باز",
  k_assigned: "واگذار شده",
  k_in_progress: "در حال انجام",
  k_blocked: "مسدود",
  k_in_review: "در حال بررسی",
  k_done: "انجام شده",

  c_title: "تقویم",
  c_no_tasks_day: "وظیفه‌ای برای این روز نیست.",

  qa_title: "پرسش‌ها",
  qa_open: "باز",
  qa_resolved: "حل‌شده",
  qa_answers: "پاسخ",
  qa_no_qs: "هنوز پرسشی نیست.",

  back: "بازگشت",
  loading: "در حال بارگذاری…",
  retry: "تلاش مجدد",
  error: "خطایی رخ داد.",
  not_member: "هنوز عضو هیچ فضای کاری KareOne نیستید. ابتدا از ربات استفاده کنید.",
  cancel: "لغو",
  save: "ذخیره",
};

const dicts: Record<string, Dict> = { en, fa };

let currentLocale = "fa";
export function setLocale(l: string) {
  currentLocale = l === "en" ? "en" : "fa";
}
export function locale() { return currentLocale; }
export function t(key: string, vars?: Record<string, string | number>): string {
  const d = dicts[currentLocale] ?? fa;
  let s = d[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
