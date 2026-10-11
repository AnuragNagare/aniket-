import { formatInTimeZone } from 'date-fns-tz';

/** 384 → "6h 24m", 45 → "45m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "9:02 AM" in the company's timezone. */
export const timeIn = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');

/** "Mon 5 Oct, 9:02 AM" in the company's timezone. */
export const dateTimeIn = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'EEE d MMM, h:mm a');

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.trim().slice(0, 2);
  return letters.toUpperCase();
}
