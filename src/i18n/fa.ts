import type { Dict } from "./en";

const fa: Dict = {
  // ---------- Generic ----------
  welcome: "به KareOne خوش آمدید، <b>{name}</b>!",
  not_member: "شما هنوز عضو هیچ فضای کاری KareOne نیستید. از مدیر خود لینک دعوت بخواهید.",
  bootstrap_done: "فضای کاری <b>{workspace}</b> آماده شد و شما مدیر ارشد هستید.",
  bootstrap_already: "این فضای کاری قبلاً راه‌اندازی شده است. توکن نصب نادیده گرفته شد.",
  permission_denied: "اجازهٔ این کار را ندارید.",
  invalid_format: "فرمت نادرست. استفاده: {usage}",
  unknown_command: "دستور را نفهمیدم. /help را امتحان کنید.",
  cancelled: "لغو شد.",
  not_found: "یافت نشد.",
  done: "انجام شد.",
  back: "⬅️ بازگشت",
  skip: "⏭️ رد کردن",
  cancel: "❌ لغو",
  refresh: "🔄 به‌روزرسانی",

  // ---------- Help ----------
  help_title: "<b>ربات KareOne — دستورات</b>",
  help_body:
    "<b>📋 وظایف</b>\n" +
    "/newtask — جادوگر تعاملی ۷ مرحله‌ای\n" +
    "/mytasks — لیست با فیلتر و مرتب‌سازی\n" +
    "/task &lt;شناسه&gt; — باز کردن کارت وظیفه\n" +
    "/find &lt;عبارت&gt; — جست‌وجوی وظایف\n" +
    "/today /overdue — فیلترهای سریع\n" +
    "/done &lt;شناسه&gt; · /assign &lt;شناسه&gt; @کاربر\n" +
    "/history &lt;شناسه&gt; — تاریخچهٔ ممیزی\n" +
    "/export — خروجی CSV\n\n" +
    "<b>🗂️ پروژه‌ها</b>\n" +
    "/projects — فهرست · /newproject — ایجاد\n\n" +
    "<b>⏱️ زمان</b>\n" +
    "/work start|stop|status &lt;شناسه&gt;\n\n" +
    "<b>❓ پرسش‌ها · پایگاه دانش</b>\n" +
    "/ask @کاربر &lt;پرسش&gt; · /answer &lt;qid&gt; &lt;متن&gt;\n" +
    "/questions · /kb &lt;عبارت&gt;\n" +
    "/upvote &lt;شناسهٔ پاسخ&gt; · /official &lt;شناسهٔ پاسخ&gt;\n\n" +
    "<b>👥 گروه‌ها</b>\n" +
    "/standup — شروع گزارش روزانه (داخل گروه)\n\n" +
    "<b>🛂 تأییدها · SLA · گزارش</b>\n" +
    "/approval &lt;شناسهٔ وظیفه&gt; @user1 @user2 [all]\n" +
    "/sla — مشاهده/تنظیم اهداف SLA (مدیر)\n" +
    "/report — آمار فضای کاری و شخصی\n\n" +
    "<b>⚙️ شما</b>\n" +
    "/settings · /whoami · /lang · /invite · /help\n\n" +
    "<i>نکته: ربات حالت inline دارد — در هر چتی @KareOnebot را تایپ کنید.</i>",
  whoami: "<b>{name}</b> — نقش: <code>{role}</code> — فضای کاری: <b>{workspace}</b>",

  // ---------- Language ----------
  choose_lang: "زبان را انتخاب کنید / Choose your language:",
  lang_set_en: "✅ Language set to English.",
  lang_set_fa: "✅ زبان روی فارسی تنظیم شد.",

  // ---------- Old quick task ----------
  task_created: "✅ وظیفهٔ <b>#{id}</b> ایجاد شد: {title}",
  task_done: "✅ وظیفهٔ <b>#{id}</b> انجام شد.",
  task_not_found: "وظیفهٔ <b>#{id}</b> یافت نشد.",
  no_tasks: "هیچ وظیفهٔ بازی ندارید. ✨",
  task_line: "• <b>#{id}</b> {title} — <i>{status}</i>{due}",
  due_label: " · سررسید {due}",
  invite_created: "این لینک را برای دعوت همکار بفرستید (۲۴ ساعت اعتبار):\n{link}",

  // ---------- Wizard ----------
  wizard_title_step: "📝 <b>گام ۱ از ۷ — عنوان</b>\nوظیفه دربارهٔ چیست؟ یک عنوان کوتاه بفرستید.",
  wizard_desc_step: "📝 <b>گام ۲ از ۷ — توضیحات</b>\nجزئیات اضافه کنید یا «رد کردن» را بزنید.",
  wizard_priority_step: "⚡ <b>گام ۳ از ۷ — اولویت</b>\nاین وظیفه چقدر اهمیت دارد؟",
  wizard_due_step: "📅 <b>گام ۴ از ۷ — سررسید</b>\nچه زمانی باید انجام شود؟",
  wizard_time_step: "🕐 <b>گام ۴ از ۷ — ساعت روز</b>\nساعت روز {date} را انتخاب کنید.",
  wizard_assignee_step: "👤 <b>گام ۵ از ۷ — مسئول</b>\nچه کسی روی این کار می‌کند؟",
  wizard_project_step: "🗂️ <b>گام ۶ از ۷ — پروژه</b>\nمتعلق به کدام پروژه است؟",
  wizard_recurrence_step: "🔁 <b>گام ۶ از ۷ — تکرار</b>\nآیا تکرار می‌شود؟",
  wizard_review_step: "📋 <b>گام ۷ از ۷ — مرور</b>",
  wizard_send_date: "تاریخ سررسید را به فرمت <code>YYYY-MM-DD</code> بفرستید:",
  wizard_send_time: "ساعت را به فرمت <code>HH:MM</code> بفرستید:",
  wizard_invalid_date: "تاریخ نامعتبر. فرمت: <code>YYYY-MM-DD</code> (مثلاً 2026-05-15).",
  wizard_invalid_time: "ساعت نامعتبر. فرمت: <code>HH:MM</code> (مثلاً 17:30).",
  wizard_send_new_title: "عنوان جدید را بفرستید:",
  wizard_send_new_desc: "توضیحات جدید را بفرستید (یا «رد کردن»):",
  wizard_cancelled: "❌ ساخت وظیفه لغو شد.",
  wizard_expired: "جادوگر منقضی شد. /newtask را برای شروع مجدد بفرستید.",
  wizard_field_title: "عنوان",
  wizard_field_desc: "توضیحات",
  wizard_field_priority: "اولویت",
  wizard_field_due: "سررسید",
  wizard_field_assignee: "مسئول",
  wizard_field_recurrence: "تکرار",
  wizard_unassigned: "— تعیین‌نشده",

  // Wizard buttons
  btn_p0: "🔴 P0 — فوری",
  btn_p1: "🟠 P1 — زیاد",
  btn_p2: "🟡 P2 — معمولی",
  btn_p3: "🟢 P3 — کم",
  btn_today: "📅 امروز",
  btn_tomorrow: "📅 فردا",
  btn_in3d: "📅 ۳ روز دیگر",
  btn_thisfri: "📅 جمعهٔ این هفته",
  btn_nextmon: "📅 دوشنبهٔ بعد",
  btn_in2w: "📅 ۲ هفته دیگر",
  btn_custom_date: "✏️ تاریخ دلخواه",
  btn_no_due: "⏭️ بدون سررسید",
  btn_morning: "🌅 صبح (۰۹:۰۰)",
  btn_eod: "🌃 پایان روز (۲۳:۵۹)",
  btn_custom_time: "✏️ ساعت دلخواه",
  btn_rec_none: "🚫 بدون تکرار",
  btn_rec_daily: "📆 روزانه",
  btn_rec_weekdays: "📅 روزهای کاری",
  btn_rec_weekly: "📅 هفتگی",
  btn_rec_biweekly: "📅 دو هفته یک‌بار",
  btn_rec_monthly: "📅 ماهانه",
  btn_assign_self: "🙋 به من واگذار کن",
  btn_assign_none: "👥 تعیین‌نشده",
  btn_create: "✅ ایجاد وظیفه",
  btn_edit_title: "✏️ ویرایش عنوان",
  btn_edit_desc: "✏️ ویرایش توضیحات",
  btn_edit_prio: "✏️ اولویت",
  btn_edit_due: "✏️ سررسید",
  btn_edit_asgn: "✏️ مسئول",
  btn_edit_rec: "✏️ تکرار",

  // ---------- Recurrence labels ----------
  rec_label_none: "بدون تکرار",
  rec_label_daily: "روزانه",
  rec_label_weekdays: "روزهای کاری (شنبه–پنج‌شنبه)",
  rec_label_weekly: "هفتگی",
  rec_label_biweekly: "دو هفته یک‌بار",
  rec_label_monthly: "ماهانه",

  // ---------- Status / Priority labels ----------
  status_open: "📂 باز",
  status_assigned: "📌 واگذار شده",
  status_in_progress: "🔧 در حال انجام",
  status_blocked: "🛑 مسدود",
  status_in_review: "👀 در حال بررسی",
  status_done: "✅ انجام شده",
  status_cancelled: "❌ لغو شده",
  status_rejected: "🚫 رد شده",
  status_archived: "🗄️ بایگانی",
  status_draft: "📝 پیش‌نویس",

  // ---------- Task card ----------
  card_due_label: "📅 سررسید: {due}",
  card_unassigned: "تعیین‌نشده",
  card_subtasks_header: "<b>زیروظایف ({n}):</b>",
  card_recent_comments: "<b>دیدگاه‌های اخیر:</b>",
  card_timer_running: "⏱️ تایمر فعال · {min} دقیقه",
  card_recurrence: "🔁 تکرار: <code>{rule}</code>",

  // Task action buttons
  btn_start: "▶️ شروع",
  btn_block: "⏸️ مسدود",
  btn_review: "👀 بررسی",
  btn_done: "✅ انجام شد",
  btn_reopen: "🔁 بازگشایی",
  btn_reassign: "👤 واگذاری مجدد",
  btn_resched: "📅 تغییر سررسید",
  btn_priority: "⚡ اولویت",
  btn_labels: "🏷️ برچسب‌ها",
  btn_comment: "💬 دیدگاه",
  btn_subtask: "➕ زیروظیفه",
  btn_snooze: "⏰ تعویق",
  btn_watch: "⭐ ستاره",
  btn_unwatch: "🌟 حذف ستاره",
  btn_timer_start: "⏱️ شروع تایمر",
  btn_timer_stop: "⏹️ توقف تایمر",
  btn_tcancel: "❌ لغو وظیفه",
  btn_view_task: "👁️ نمایش وظیفه",
  btn_open_task: "👁️ باز کردن وظیفه",
  btn_my_tasks: "📋 وظایف من",
  btn_new_task: "➕ وظیفهٔ جدید",
  btn_to_me: "🙋 به من",
  btn_back: "⬅️ بازگشت",
  btn_prev: "⬅️ قبلی",
  btn_next: "بعدی ➡️",
  btn_close: "✖️ بستن",
  btn_clear_due: "🚫 حذف سررسید",
  btn_in_1h: "⏰ ۱ ساعت دیگر",
  btn_in_3h: "⏰ ۳ ساعت دیگر",
  btn_tom_9: "📅 فردا ۹ صبح",
  btn_mon_9: "📅 دوشنبهٔ بعد",
  btn_approve: "✅ تأیید",
  btn_reject: "❌ رد",

  // Task card prompts
  comment_prompt: "💬 دیدگاه خود را برای وظیفهٔ #{id} بفرستید (یا /cancel):",
  comment_added: "✅ دیدگاه اضافه شد.",
  subtask_prompt: "➕ عنوان زیروظیفه برای #{id} را بفرستید (یا /cancel):",
  subtask_created: "✅ زیروظیفهٔ <b>#{id}</b> ایجاد شد.",
  parent_not_found: "وظیفهٔ والد یافت نشد.",
  reassign_prompt: "👤 واگذاری وظیفهٔ #{id} به:",
  resched_prompt: "📅 تغییر سررسید وظیفهٔ #{id}:",
  priority_prompt: "⚡ اولویت وظیفهٔ #{id} را انتخاب کنید:",
  snooze_prompt: "⏰ تعویق وظیفهٔ #{id} تا:",
  reassigned_to: "✅ وظیفهٔ #{id} به {who} واگذار شد.",
  user_not_in_workspace: "کاربر {who} عضو این فضای کاری نیست.",
  task_assigned_dm: "🆕 وظیفهٔ <b>#{id}</b> به شما واگذار شد.\n{title}",
  notify_status_change: "🔄 وضعیت <b>#{id}</b> → <i>{status}</i>",
  notify_new_comment: "💬 دیدگاه جدید روی <b>#{id}</b>",
  no_timer: "تایمری در حال اجرا نیست.",
  timers_require_redis: "تایمرها به Redis نیاز دارند.",
  closed: "بسته شد.",

  // ---------- Task list ----------
  list_header: "📋 <b>وظایف من</b> · {filter} · مرتب‌سازی بر اساس {sort}",
  list_empty: "\n\n<i>وظیفه‌ای با این فیلتر یافت نشد.</i>",
  list_filter_all: "📥 همه",
  list_filter_today: "📅 امروز",
  list_filter_overdue: "🚨 عقب‌افتاده",
  list_filter_week: "🗓️ هفته",
  list_filter_done: "✅ انجام‌شده",
  list_filter_watching: "⭐ ستاره‌دار",
  list_sort_due: "⏰ سررسید",
  list_sort_prio: "⚡ اولویت",
  list_sort_new: "🆕 جدیدترین",
  list_filter_label_all: "همهٔ بازها",
  list_filter_label_today: "امروز",
  list_filter_label_overdue: "عقب‌افتاده",
  list_filter_label_week: "۷ روز آینده",
  list_filter_label_done: "انجام‌شده",
  list_filter_label_watching: "ستاره‌دار",
  list_sort_label_due: "سررسید",
  list_sort_label_prio: "اولویت",
  list_sort_label_new: "جدیدترین",

  // ---------- Settings ----------
  settings_title: "⚙️ <b>تنظیمات</b>\nبخش را انتخاب کنید:",
  set_btn_lang: "🌐 زبان",
  set_btn_notif: "🔔 اعلان‌ها",
  set_btn_quiet: "🌙 ساعات سکوت",
  set_btn_tz: "🕒 منطقهٔ زمانی",
  set_lang_title: "🌐 <b>زبان</b>",
  set_notif_title: "🔔 <b>اعلان‌ها</b>\nاعلان‌های دریافتی را تغییر دهید:",
  set_notif_digest: "خلاصهٔ روزانه",
  set_quiet_title: "🌙 <b>ساعات سکوت</b>\nچه ساعاتی به شما اطلاع ندهم؟",
  set_quiet_disable: "☀️ غیرفعال",
  set_quiet_disabled: "✅ ساعات سکوت غیرفعال شد.",
  set_quiet_set: "✅ ساعات سکوت: {start} → {end}",
  set_tz_admin_only: "🕒 منطقهٔ زمانی در سطح فضای کاری تنظیم می‌شود. از مدیر بخواهید.",
  set_notif_digest_state: "🔔 <b>اعلان‌ها</b>\nخلاصهٔ روزانه: {state}",

  // ---------- Q&A ----------
  qa_send_answer: "💬 پاسخ خود به Q#{id} را بفرستید (یا /cancel):",
  qa_q_not_found: "Q#{id} یافت نشد.",
  qa_answer_posted: "✅ پاسخ به Q#{id} ثبت شد.",
  qa_new_answer_dm: "💬 پاسخ جدید روی Q#{id} از <b>{who}</b>:\n{body}",
  qa_no_open: "هیچ پرسش بازی نیست. ✨",
  qa_question_sent: "📨 پرسش #{id} فرستاده شد.",
  qa_question_dm: "❓ پرسش از <b>{who}</b> (Q#{id}):\n{body}",
  qa_upvoted: "👍 پاسخ #{id} رأی مثبت گرفت (مجموع: {n}).",
  qa_marked_official: "⭐ پاسخ #{id} به‌عنوان رسمی علامت‌گذاری شد.",
  qa_already_official: "قبلاً به‌عنوان رسمی علامت خورده.",
  qa_answer_not_found: "پاسخ #{id} یافت نشد.",
  qa_use_answer: "استفاده: /answer <شناسهٔ پرسش> <متن>",
  qa_use_upvote: "استفاده: /upvote <شناسهٔ پاسخ>",
  qa_use_official: "استفاده: /official <شناسهٔ پاسخ>",
  qa_only_asker_can_official: "فقط پرسشگر می‌تواند پاسخ رسمی را علامت بزند.",

  // ---------- KB ----------
  kb_no_results: "📚 هیچ مدخلی برای <b>{q}</b> یافت نشد.",
  kb_results_header: "📚 <b>نتایج پایگاه دانش برای «{q}»:</b>\n",
  kb_use: "استفاده: /kb <عبارت> — جست‌وجو در پرسش‌های پاسخ‌داده‌شده",

  // ---------- Approvals ----------
  ap_use:
    "استفاده: <code>/approval &lt;شناسهٔ وظیفه&gt; @user1 @user2 ... [all]</code>\n" +
    "<i>پیش‌فرض «هرکسی» (یک تأییدکننده کافی است). برای الزام به تأیید همه، کلمهٔ all را بگذارید.</i>",
  ap_no_approvers: "هیچ‌یک از کاربران ذکرشده عضو این فضای کاری نیستند.",
  ap_dm:
    "🛂 <b>درخواست تأیید</b>\nوظیفهٔ <b>#{id}</b> · {title}\nدرخواست از <b>{who}</b>",
  ap_started:
    "✅ درخواست تأیید برای <b>#{id}</b> ثبت شد.\nحالت: <b>{mode}</b>\nتأییدکنندگان مطلع شدند: {n}",
  ap_mode_all: "نیاز به تأیید همه",
  ap_mode_any: "هرکدام از تأییدکنندگان",
  ap_send_reason: "✏️ یک دلیل کوتاه برای رد بفرستید (یا /skip):",
  ap_not_yours: "این تأیید به شما تعلق ندارد.",
  ap_already_decided: "قبلاً {decision} کرده‌اید.",
  ap_recorded: "ثبت شد: <b>{decision}</b>",
  ap_recorded_with_reason: "ثبت شد: <b>{decision}</b>\nدلیل: {reason}",
  ap_resolved_dm: "{emoji} تأیید روی <b>#{id}</b> نهایی شد: <b>{status}</b>",

  // ---------- SLA ----------
  sla_header: "⏱️ <b>سیاست‌های SLA</b> (پاسخ → حل)",
  sla_defaults_header: "⏱️ <b>اهداف پیش‌فرض SLA</b>",
  sla_change_hint:
    "برای تغییر: <code>/sla set &lt;p0|p1|p2|p3&gt; &lt;دقیقهٔ پاسخ&gt; &lt;دقیقهٔ حل&gt;</code>\nبا حذف سطر، پیش‌فرض‌ها بازمی‌گردند.",
  sla_set: "✅ SLA {priority} → پاسخ {resp}، حل {reso}.",
  sla_warn:
    "⚠️ <b>هشدار SLA</b>\nوظیفهٔ <b>#{id}</b> · {title}\n۸۰٪ پنجرهٔ SLA مصرف شده.",
  sla_breach:
    "🚨 <b>نقض SLA</b>\nوظیفهٔ <b>#{id}</b> · {title}\nپنجرهٔ حل گذشته است.",
  sla_use: "استفاده: /sla [show|defaults|set <p> <resp> <reso>]",
  sla_admin_only: "فقط مدیران.",

  // ---------- Report ----------
  report_title: "📊 <b>گزارش فضای کاری</b>",
  report_status: "<b>وظایف بر اساس وضعیت</b> (مجموع {total})",
  report_priority: "<b>وظایف بر اساس اولویت</b>",
  report_you: "<b>شما</b>",
  report_open: "📥 باز: {n}",
  report_done_week: "✅ انجام‌شده در ۷ روز اخیر: {n}",
  report_overdue: "🚨 عقب‌افتاده: {n}",
  report_logged: "⏱️ مجموع زمان ثبت‌شده: {h} ساعت {m} دقیقه",

  // ---------- Find / search ----------
  find_use: "استفاده: /find <عبارت>",
  find_no_results: "هیچ وظیفه‌ای برای <b>{q}</b> یافت نشد.",
  find_results_header: "🔎 <b>نتایج برای «{q}»:</b>",

  // ---------- Projects ----------
  proj_use_create: "استفاده: /newproject <نام>",
  proj_created: "🗂️ پروژهٔ <b>#{id}</b> — {name} — ایجاد شد.",
  proj_none: "هنوز پروژه‌ای ندارید. با /newproject <نام> یکی بسازید.",
  proj_list_header: "🗂️ <b>پروژه‌ها</b>",
  proj_btn_no_project: "🚫 بدون پروژه",

  // ---------- Time tracking ----------
  work_use: "استفاده: /work start <شناسه> · /work stop <شناسه> · /work status",
  work_no_timers: "تایمری در حال اجرا نیست.",
  work_status_line: "⏱️ #{id} — در حال اجرا {m} دقیقه",
  work_started: "▶️ تایمر روی وظیفهٔ #{id} شروع شد.",
  work_no_timer_on: "تایمری روی #{id} در حال اجرا نیست.",
  work_stopped: "⏹️ تایمر متوقف شد. <b>{m} دقیقه</b> روی #{id} ثبت شد.",

  // ---------- Export ----------
  export_empty: "وظیفه‌ای برای خروجی‌گیری وجود ندارد.",
  export_caption: "📁 وظایف شما ({n}) — CSV",

  // ---------- History ----------
  history_use: "استفاده: /history <شناسهٔ وظیفه>",
  history_header: "📜 <b>تاریخچهٔ #{id}</b>",
  history_empty: "هنوز هیچ ورودی ممیزی برای این وظیفه ثبت نشده.",

  // ---------- Standup / groups ----------
  standup_only_in_groups: "/standup را داخل یک گروه تیمی اجرا کنید (نه در چت خصوصی).",
  standup_started: "📣 <b>گزارش روزانه</b>\nپاسخ دهید: ۱) دیروز ۲) امروز ۳) موانع.",
  standup_logged: "✅ گزارش ثبت شد.",
};

export default fa;
