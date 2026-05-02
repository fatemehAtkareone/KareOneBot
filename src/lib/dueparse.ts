import { DateTime } from "luxon";

/**
 * Lightweight natural-date parser.
 * Supported: "today", "tomorrow", "in N (minutes|hours|days)",
 * "<weekday> [HH(:MM)?(am|pm)?]", "YYYY-MM-DD [HH:MM]",
 * "today 5pm", "tomorrow 17:30".
 */
export function parseDue(input: string, timezone: string): Date | null {
  const s = input.trim().toLowerCase();
  const now = DateTime.now().setZone(timezone);

  if (s === "today") return now.endOf("day").toJSDate();
  if (s === "tomorrow") return now.plus({ days: 1 }).endOf("day").toJSDate();

  const inMatch = s.match(/^in\s+(\d+)\s*(min(?:utes?)?|h(?:ours?)?|d(?:ays?)?)$/);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const u = inMatch[2]!;
    const dur = u.startsWith("min") ? { minutes: n } : u.startsWith("h") ? { hours: n } : { days: n };
    return now.plus(dur).toJSDate();
  }

  const dateTime = s.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dateTime) {
    const [, date, hh, mm] = dateTime;
    const iso = hh ? `${date}T${hh!.padStart(2, "0")}:${mm}` : `${date}T17:00`;
    const dt = DateTime.fromISO(iso, { zone: timezone });
    return dt.isValid ? dt.toJSDate() : null;
  }

  const dayPlusTime = s.match(/^(today|tomorrow)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (dayPlusTime) {
    const [, day, hRaw, mRaw, ampm] = dayPlusTime;
    let h = Number(hRaw);
    const m = mRaw ? Number(mRaw) : 0;
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    const base = day === "today" ? now : now.plus({ days: 1 });
    return base.set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
  }

  return null;
}

export function formatDue(date: Date | null, timezone: string, locale = "fa"): string {
  if (!date) return "";
  return DateTime.fromJSDate(date).setZone(timezone).setLocale(locale).toFormat("yyyy-LL-dd HH:mm");
}
