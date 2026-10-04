import { formatInTimeZone } from 'date-fns-tz';

/** 384 → "6h 24m", 45 → "45m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Whole hours for a KPI headline: 5190 → "86h". */
export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h`;

/** Percent change vs a baseline; null when there's nothing to compare with. */
export function percentChange(current: number, baseline: number): number | null {
  if (baseline === 0) return null;
  return Math.round(((current - baseline) / baseline) * 100);
}

export function greeting(now: Date, tz: string) {
  const hour = Number(formatInTimeZone(now, tz, 'H'));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "10:18 AM" in the company's timezone. */
export const timeIn = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
