import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date (YYYY-MM-DD) in the given timezone. */
export const todayIn = (tz: string, now = new Date()) => formatInTimeZone(now, tz, 'yyyy-MM-dd');

/** True only for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
}

/** Shifts a YYYY-MM-DD calendar date by whole days (timezone-free arithmetic). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const previousDay = (date: string) => shiftDate(date, -1);

/** The UTC instants where a calendar day starts and ends in `tz` ([start, end)). */
export function dayBounds(date: string, tz: string) {
  return {
    start: fromZonedTime(`${date}T00:00:00`, tz),
    end: fromZonedTime(`${shiftDate(date, 1)}T00:00:00`, tz),
  };
}

/**
 * Minutes of work that fall inside [start, end). Open sessions count up to `now`, and a
 * session crossing midnight is split between the two days.
 */
export function minutesWithin(
  sessions: Array<{ start: Date; end: Date | null }>,
  start: Date,
  end: Date,
  now: Date,
): number {
  let ms = 0;
  for (const s of sessions) {
    const from = Math.max(s.start.getTime(), start.getTime());
    const to = Math.min((s.end ?? now).getTime(), end.getTime(), now.getTime());
    if (to > from) ms += to - from;
  }
  return Math.round(ms / 60_000);
}
