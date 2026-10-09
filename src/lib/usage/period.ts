// Quota periods on the Europe/Istanbul calendar: a day starts at 00:00 Istanbul time, a week on
// Monday 00:00, a month on the 1st 00:00. Boundaries are computed from the clock (no cron job):
// a usage belongs to the period that contains its timestamp.
// The zone offset is read with Intl, so this stays right even if Türkiye changes its offset again.

export const QUOTA_TIME_ZONE = "Europe/Istanbul";
export const PERIOD_TYPES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: QUOTA_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

/** Wall-clock parts in Istanbul. weekday: 0 = Monday … 6 = Sunday. */
export function istanbulParts(date: Date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Istanbul offset from UTC in ms at `date` (e.g. +3 h = 10 800 000). */
function offsetMs(date: Date) {
  const p = istanbulParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 Istanbul time on the given calendar day (month 1–12; overflow allowed). */
export function istanbulMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetMs(new Date(guess));
  const corrected = guess - offsetMs(new Date(t));
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/** [start, end) of the period containing `now`. */
export function periodBounds(periodType: PeriodType, now: Date = new Date()): { start: Date; end: Date } {
  const p = istanbulParts(now);
  switch (periodType) {
    case "DAILY":
      return { start: istanbulMidnight(p.year, p.month, p.day), end: istanbulMidnight(p.year, p.month, p.day + 1) };
    case "WEEKLY":
      return { start: istanbulMidnight(p.year, p.month, p.day - p.weekday), end: istanbulMidnight(p.year, p.month, p.day - p.weekday + 7) };
    case "MONTHLY":
      return { start: istanbulMidnight(p.year, p.month, 1), end: istanbulMidnight(p.year, p.month + 1, 1) };
  }
}

export const isPeriodType = (v: unknown): v is PeriodType => typeof v === "string" && (PERIOD_TYPES as readonly string[]).includes(v);

export const PERIOD_LABELS: Record<PeriodType, string> = { DAILY: "Günlük", WEEKLY: "Haftalık", MONTHLY: "Aylık" };

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: QUOTA_TIME_ZONE, day: "numeric", month: "long", year: "numeric", weekday: "long" });
const shortFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: QUOTA_TIME_ZONE, day: "numeric", month: "long", weekday: "long" });

/** "13 Ekim 2026 Pazartesi" – a reset day in Istanbul time. */
export const formatResetDate = (d: Date) => dateFormatter.format(d);

/** Short reset hint for usage bars: "Yarın 00:00'da yenilenir" / "13 Ekim Pazartesi 00:00'da yenilenir". */
export function resetHint(periodType: PeriodType, end: Date, now: Date = new Date()) {
  const tomorrow = periodBounds("DAILY", now).end;
  if (end.getTime() === tomorrow.getTime()) return "Yarın 00:00'da yenilenir";
  return `${shortFormatter.format(end)} 00:00'da yenilenir`;
}
