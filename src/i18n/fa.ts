import type { Dict } from "./en";

const fa: Dict = {
  welcome: "به KareOne خوش آمدید، {name}!",
  not_member: "شما هنوز عضو هیچ فضای کاری KareOne نیستید. از مدیر خود لینک دعوت بخواهید.",
  bootstrap_done: "فضای کاری *{workspace}* آماده شد و شما مدیر ارشد هستید.",
  bootstrap_already: "این فضای کاری قبلاً راه‌اندازی شده است. توکن نصب نادیده گرفته شد.",
  help_title: "*ربات KareOne — دستورات*",
  help_body:
    "/newtask — ساخت وظیفه (تعاملی)\n" +
    "/mytasks — وظایف اختصاص داده‌شده به شما\n" +
    "/today — وظایف امروز\n" +
    "/overdue — وظایف عقب‌افتاده\n" +
    "/done <شناسه> — اتمام وظیفه\n" +
    "/assign <شناسه> @کاربر — واگذاری مجدد\n" +
    "/ask @کاربر <پرسش> — پرسش از همکار\n" +
    "/whoami — نمایش پروفایل\n" +
    "/invite — ساخت لینک دعوت (فقط مدیران)\n" +
    "/help — نمایش این راهنما",
  whoami: "*{name}* — نقش: `{role}` — فضای کاری: *{workspace}*",
  unknown_command: "دستور را نفهمیدم. /help را امتحان کنید.",
  task_created: "✅ وظیفه *#{id}* ایجاد شد: {title}",
  task_done: "✅ وظیفه *#{id}* انجام شد.",
  task_not_found: "وظیفه *#{id}* یافت نشد.",
  no_tasks: "هیچ وظیفه بازی ندارید. ✨",
  task_line: "• *#{id}* {title} — _{status}_{due}",
  due_label: " · سررسید {due}",
  permission_denied: "اجازه این کار را ندارید.",
  invite_created: "این لینک را برای دعوت همکار بفرستید (۲۴ ساعت اعتبار):\n{link}",
  invalid_format: "فرمت نادرست. استفاده: {usage}",
  wizard_title: "عنوان وظیفه چیست؟",
  wizard_assignee: "به چه کسی اختصاص یابد؟ با @نام‌کاربری پاسخ دهید یا /skip.",
  wizard_due: "سررسید؟ مثلاً `فردا ۱۷` یا `2026-05-10` یا /skip.",
  wizard_priority: "اولویت؟ p0/p1/p2/p3 یا /skip.",
  wizard_cancelled: "لغو شد.",
};

export default fa;
