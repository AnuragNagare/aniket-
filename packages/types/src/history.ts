import { z } from 'zod';
import { DateRangeSchema } from './ranges.js';
import type { WorkSessionDto } from './sessions.js';
import type { WorkUpdateDto } from './updates.js';

export const HistoryQuerySchema = DateRangeSchema;
export type HistoryQuery = z.output<typeof HistoryQuerySchema>;

export type HistoryResponse = {
  timezone: string;
  sessions: WorkSessionDto[];
  updates: WorkUpdateDto[];
};
