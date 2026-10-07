import { z } from 'zod';

export const LocationFixSchema = z.object({
  /** Generated on the phone; the API ignores a point it has already stored with this id. */
  clientPointId: z.string().uuid(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.'),
  accuracyMeters: z.number().min(0).max(100_000).nullable().optional(),
  capturedAt: z.string().datetime(),
  batteryLevel: z.number().min(0).max(1).nullable().optional(),
});
export type LocationFix = z.output<typeof LocationFixSchema>;

export const StartSessionSchema = z.object({
  deviceTime: z.string().datetime(),
  initialLocation: LocationFixSchema.optional(),
});
export type StartSessionInput = z.output<typeof StartSessionSchema>;

export const EndSessionSchema = z.object({
  deviceTime: z.string().datetime(),
  /** The phone's estimate of server time when End was tapped (matters when ended offline). */
  endedAt: z.string().datetime().optional(),
  finalLocation: LocationFixSchema.optional(),
});
export type EndSessionInput = z.output<typeof EndSessionSchema>;

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'INCOMPLETE';

export type WorkSessionDto = {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  totalMinutes: number | null;
  lastLocationAt: string | null;
};

/** serverTime lets the app correct for a wrong phone clock. */
export type ActiveSessionResponse = { session: WorkSessionDto | null; serverTime: string };
export type SessionMutationResponse = { session: WorkSessionDto; serverTime: string };
