import { parseRange, type SearchParams } from '@worktrail/types';

// Period presets and range parsing are shared with the mobile app: see packages/types/src/period.ts.
export {
  PRESETS,
  PRESET_LABELS,
  parseRange,
  presetRange,
  rangeQuery,
  type ParsedRange,
  type Preset,
  type SearchParams,
} from '@worktrail/types';

export async function pageRange(searchParams: Promise<SearchParams>, timezone: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // YYYY-MM-DD
  return { range: parseRange(await searchParams, today), today };
}
