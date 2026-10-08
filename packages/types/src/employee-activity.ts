import { z } from 'zod';
import type { EmployeeListItem } from './employees.js';
import { checkRange, rangeShape } from './ranges.js';
import type { SessionStatus, WorkSessionDto } from './sessions.js';
import { UPDATE_CATEGORIES, type WorkUpdateDto } from './updates.js';

export const LEFT_RUNNING_AFTER_MS = 14 * 3600_000;

export type EmployeeDetail = EmployeeListItem & {
  phone: string | null;
  joinedAt: string;
  workingSince: string | null;
  lastSeenAt: string | null;
  consentedAt: string | null;
  consentVersion: string | null;
  deactivated: boolean;
};

export type EmployeeSummary = {
  from: string;
  to: string;
  totalMinutes: number;
  daysWorked: number;
  updateCount: number;
  pointCount: number;
  distanceKm: number;
  lastSeenAt: string | null;
  leftRunning: boolean;
};

export type AdminSessionDto = WorkSessionDto & { pointCount: number; leftRunning: boolean };
export type DayMinutes = { date: string; minutes: number };
export type EmployeeSessionsResponse = { timezone: string; sessions: AdminSessionDto[]; days: DayMinutes[]; totalMinutes: number };

export type TrailPoint = {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  capturedAt: string;
  source: 'START' | 'BACKGROUND' | 'END' | 'MANUAL';
  qualityFlag: 'GOOD' | 'LOW_ACCURACY' | 'SUSPICIOUS' | 'INVALID';
};
export type TrailGap = { sessionId: string; from: string; to: string; minutes: number };
export type TrailStats = { pointCount: number; lowAccuracyCount: number; gapCount: number; distanceKm: number };
export type TrailSession = { id: string; status: SessionStatus; startedAt: string; endedAt: string | null };
export type LocationTrailResponse = {
  timezone: string;
  sessions: TrailSession[];
  points: TrailPoint[];
  gaps: TrailGap[];
  stats: TrailStats;
  truncated: boolean;
};

const page = z.coerce.number().int().min(1).default(1);

export const EmployeeUpdatesQuerySchema = checkRange(
  z.object({
    ...rangeShape,
    category: z.enum(UPDATE_CATEGORIES).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  }),
);
export type EmployeeUpdatesQuery = z.output<typeof EmployeeUpdatesQuerySchema>;
export type EmployeeUpdatesResponse = { items: WorkUpdateDto[]; page: number; pageSize: number; total: number };

export const CloseSessionSchema = z.object({ endedAt: z.string().datetime() });
export type CloseSessionInput = z.output<typeof CloseSessionSchema>;

export const WORK_SESSION_FILTERS = ['ACTIVE', 'COMPLETED', 'LEFT_RUNNING', 'CLOSED'] as const;
export const WorkSessionsQuerySchema = checkRange(
  z.object({
    ...rangeShape,
    status: z.enum(WORK_SESSION_FILTERS).optional(),
    query: z.string().trim().max(160).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }),
);
export type WorkSessionsQuery = z.output<typeof WorkSessionsQuerySchema>;
export type WorkSessionRow = AdminSessionDto & { employeeId: string; employeeName: string };
export type WorkSessionsResponse = { timezone: string; items: WorkSessionRow[]; page: number; pageSize: number; total: number };

/** One word for an admin: how this session ended (or didn't). */
export function sessionLabel(s: { status: SessionStatus; leftRunning: boolean }) {
  if (s.status === 'INCOMPLETE') return 'Closed by admin' as const;
  if (s.status === 'COMPLETED') return 'Completed' as const;
  return s.leftRunning ? ('Left running' as const) : ('Active' as const);
}
