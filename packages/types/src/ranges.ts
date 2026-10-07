import { z } from 'zod';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in the format YYYY-MM-DD.');
export const MAX_RANGE_DAYS = 31;
const DAY_MS = 86_400_000;

const dayDiff = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;

/** Adds the shared period rules to any object schema that has from/to. */
export function checkRange<T extends z.ZodObject<{ from: typeof IsoDateSchema; to: typeof IsoDateSchema }>>(schema: T) {
  return schema
    .refine((q) => q.to >= q.from, { message: 'The end date must be on or after the start date.', path: ['to'] })
    .refine((q) => dayDiff(q.from, q.to) < MAX_RANGE_DAYS, { message: `Choose at most ${MAX_RANGE_DAYS} days.`, path: ['from'] });
}

export const rangeShape = { from: IsoDateSchema, to: IsoDateSchema };
export const DateRangeSchema = checkRange(z.object(rangeShape));
export type DateRange = z.output<typeof DateRangeSchema>;
