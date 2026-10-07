// Deadlines are picked as a Türkiye wall-clock date + time. Türkiye is fixed at UTC+03:00 (no DST
// since 2016), so the picked value is converted with an explicit offset: the stored instant is the
// same whatever time zone the teacher's browser or the server happens to be in.

export const TURKEY_OFFSET = "+03:00";
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-08" + "17" + "30" -> ISO instant (UTC), or "" when any part is missing/invalid. */
export function turkeyDeadlineToIso(date: string, hour: string, minute: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return "";
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return "";
  const d = new Date(`${date}T${pad(h)}:${pad(m)}:00${TURKEY_OFFSET}`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Today's date in Türkiye as "YYYY-MM-DD" (for the date input's min). */
export function turkeyToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO instant -> Türkiye wall-clock parts for the picker ({ date: "YYYY-MM-DD", hour: "HH", minute: "MM" }). */
export function isoToTurkeyParts(iso: string | Date) {
  const d = new Date(new Date(iso).getTime() + TURKEY_OFFSET_MS).toISOString();
  return { date: d.slice(0, 10), hour: d.slice(11, 13), minute: d.slice(14, 16) };
}
