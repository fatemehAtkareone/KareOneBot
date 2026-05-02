import type { Dict } from "./en";

const fa: Dict = {
  welcome: "به KareOne خوش آمدید، <b>{name}</b>!",
  not_member: "شما هنوز عضو هیچ فضای کاری KareOne نیستید. از مدیر خود لینک دعوت بخواهید.",
  bootstrap_done: "فضای کاری <b>{workspace}</b> آماده شد و شما مدیر ارشد هستید.",
  bootstrap_already: "این فضای کاری قبلاً راه‌اندازی شده است. توکن نصب نادیده گرفته شد.",
  help_title: "<b>ربات KareOne — دستورات</b>",
  help_body:
    "<b>📋 وظایف</b>\n" +
    "/newtask — جادوگر تعاملی ۷ مرحله‌ای\n" +
    "/mytasks — لیست با فیلتر و مرتب‌سازی\n" +
    "/task &lt;شناسه&gt; — باز کردن کارت وظیفه\n" +
    "/today — وظایف امروز\n" +
    "/overdue — وظایف عقب‌افتاده\n" +
    "/done &lt;شناسه&gt; — اتمام سریع\n" +
    "/assign &lt;شناسه&gt; @کاربر — واگذاری مجدد\n\n" +
    "<b>⏱️ زمان</b>\n" +
    "/work start &lt;id&gt; · /work stop &lt;id&gt; · /work status\n\n" +
    "<b>❓ پرسش‌ها · پایگاه دانش</b>\n" +
    "/ask @کاربر &lt;پرسش&gt; — پرسیدن\n" +
    "/answer &lt;qid&gt; &lt;متن&gt; — پاسخ دادن\n" +
    "/questions — پرسش‌های باز\n" +
    "/kb &lt;عبارت&gt; — جست‌وجوی پاسخ‌ها\n\n" +
    "<b>🛂 تأییدها · SLA · گزارش</b>\n" +
    "/approval &lt;شناسه&gt; @user1 @user2 [all] — درخواست تأیید\n" +
    "/sla — نمایش/تنظیم SLA (مدیر)\n" +
    "/report — آمار فضای کاری\n\n" +
    "<b>⚙️ شما و فضای کاری</b>\n" +
    "/settings — تنظیمات\n" +
    "/whoami — پروفایل\n" +
    "/lang — تغییر زبان\n" +
    "/invite — لینک دعوت (مدیران)\n" +
    "/help — این راهنما",
  whoami: "<b>{name}</b> — نقش: <code>{role}</code> — فضای کاری: <b>{workspace}</b>",
  unknown_command: "دستور را نفهمیدم. /help را امتحان کنید.",
  task_created: "✅ وظیفه <b>#{id}</b> ایجاد شد: {title}",
  task_done: "✅ وظیفه <b>#{id}</b> انجام شد.",
  task_not_found: "وظیفه <b>#{id}</b> یافت نشد.",
  no_tasks: "هیچ وظیفه بازی ندارید. ✨",
  task_line: "• <b>#{id}</b> {title} — <i>{status}</i>{due}",
  due_label: " · سررسید {due}",
  permission_denied: "اجازه این کار را ندارید.",
  invite_created: "این لینک را برای دعوت همکار بفرستید (۲۴ ساعت اعتبار):\n{link}",
  invalid_format: "فرمت نادرست. استفاده: {usage}",
  wizard_title: "عنوان وظیفه چیست؟",
  wizard_assignee: "به چه کسی اختصاص یابد؟ با @نام‌کاربری پاسخ دهید یا /skip.",
  wizard_due: "سررسید؟ مثلاً <code>فردا ۱۷</code> یا <code>2026-05-10</code> یا /skip.",
  wizard_priority: "اولویت؟ p0/p1/p2/p3 یا /skip.",
  wizard_cancelled: "لغو شد.",
  choose_lang: "زبان را انتخاب کنید / Choose your language:",
  lang_set_en: "✅ Language set to English.",
  lang_set_fa: "✅ زبان روی فارسی تنظیم شد.",
};

export default fa;
