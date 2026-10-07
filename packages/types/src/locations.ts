import { z } from 'zod';
import { LocationFixSchema } from './sessions.js';

export const MAX_BATCH_POINTS = 100;

export const BatchPointSchema = LocationFixSchema.extend({
  speedMps: z.number().min(0).max(100).nullable().optional(),
  bearing: z.number().min(0).max(360).nullable().optional(),
  source: z.enum(['BACKGROUND', 'MANUAL']).default('BACKGROUND'),
});
export type BatchPoint = z.input<typeof BatchPointSchema>;

export const LocationBatchSchema = z.object({
  sessionId: z.string().uuid(),
  points: z
    .array(BatchPointSchema)
    .min(1, 'Send at least one point.')
    .max(MAX_BATCH_POINTS, `Send at most ${MAX_BATCH_POINTS} points at a time.`),
});
export type LocationBatchInput = z.output<typeof LocationBatchSchema>;

export type RejectedPoint = { clientPointId: string; reason: 'OUTSIDE_SESSION' };

export type LocationBatchResponse = {
  /** Newly stored points. */
  accepted: number;
  /** Points the server already had (a retry); safe to drop from the phone's queue. */
  duplicates: number;
  /** Points not stored; also safe to drop. */
  rejected: RejectedPoint[];
  lastLocationAt: string | null;
};
