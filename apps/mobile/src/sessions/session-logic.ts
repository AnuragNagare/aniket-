import { formatInTimeZone } from 'date-fns-tz';

const STALE_AFTER_MS = 14 * 3600_000;

/** Milliseconds since start, measured on the server clock (offset = serverNow − phoneNow). */
export const elapsedMs = (startedAt: string, offsetMs: number, now: number) =>
  Math.max(0, now + offsetMs - Date.parse(startedAt));

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const timeLabel = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');

/** "Sun 4 Oct at 9:02 AM" — used when a session began on another day. */
export const dayTimeLabel = (iso: string, tz: string) =>
  formatInTimeZone(new Date(iso), tz, "EEE d MMM 'at' h:mm a");

/** A session that started on an earlier day, or long ago, was probably left running by mistake. */
export function isStale(startedAt: string, now: Date, tz: string): boolean {
  const start = new Date(startedAt);
  const differentDay =
    formatInTimeZone(start, tz, 'yyyy-MM-dd') !== formatInTimeZone(now, tz, 'yyyy-MM-dd');
  return differentDay || now.getTime() - start.getTime() > STALE_AFTER_MS;
}
