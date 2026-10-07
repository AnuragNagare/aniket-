import { DateRangeSchema } from '@worktrail/types';

export const PRESETS = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'custom'] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  custom: 'Custom',
};

type Range = { from: string; to: string };
export type ParsedRange = Range & { preset: Preset; label: string; error: string | null };
type SearchParams = Record<string, string | string[] | undefined>;

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** 0 = Monday … 6 = Sunday. */
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const fmt = (date: string, withYear: boolean) =>
  new Date(`${date}T00:00:00Z`)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .replace('Sept', 'Sep');

export function presetRange(preset: Exclude<Preset, 'custom'>, today: string): Range {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = shift(today, -1);
      return { from: y, to: y };
    }
    case 'this-week':
      return { from: shift(today, -weekday(today)), to: today };
    case 'last-week': {
      const monday = shift(today, -weekday(today) - 7);
      return { from: monday, to: shift(monday, 6) };
    }
    case 'this-month':
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

export function parseRange(sp: SearchParams, today: string): ParsedRange {
  const preset = (PRESETS as readonly string[]).includes(first(sp.range) ?? '') ? (first(sp.range) as Preset) : 'today';
  if (preset !== 'custom') return { preset, ...presetRange(preset, today), label: PRESET_LABELS[preset], error: null };

  const parsed = DateRangeSchema.safeParse({ from: first(sp.from), to: first(sp.to) });
  if (!parsed.success) {
    return { preset: 'today', ...presetRange('today', today), label: 'Today', error: parsed.error.issues[0]?.message ?? 'Choose a valid period.' };
  }
  const { from, to } = parsed.data;
  return { preset, from, to, label: `${fmt(from, false)} – ${fmt(to, true)}`, error: null };
}

export const rangeQuery = (r: Pick<ParsedRange, 'preset' | 'from' | 'to'>) =>
  r.preset === 'custom' ? `?range=custom&from=${r.from}&to=${r.to}` : `?range=${r.preset}`;
