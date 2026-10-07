import { z } from 'zod';
import type { PeriodReport } from './ai.js';
import { checkRange, rangeShape } from './ranges.js';

export const PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
export type ReportStatus = 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => new Date(utc(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function periodTypeFor(from: string, to: string): PeriodType {
  if (from === to) return 'DAILY';
  if (utc(from).getUTCDay() === 1 && to === addDays(from, 6)) return 'WEEKLY';
  const lastOfMonth = new Date(Date.UTC(utc(from).getUTCFullYear(), utc(from).getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  if (from.endsWith('-01') && to === lastOfMonth) return 'MONTHLY';
  return 'CUSTOM';
}

export const SummaryQuerySchema = checkRange(z.object({ ...rangeShape, period: z.enum(PERIOD_TYPES).optional() }));
export type SummaryQuery = z.output<typeof SummaryQuerySchema>;
export const CreateSummarySchema = checkRange(z.object(rangeShape));

export type PeriodSummaryDto = {
  id: string;
  periodType: PeriodType;
  from: string;
  to: string;
  status: JobStatus;
  report: PeriodReport | null;
  sourceUpdateCount: number;
  sourceSessionMinutes: number;
  modelName: string | null;
  generatedAt: string | null;
  requestedAt: string;
};

export const CreateReportSchema = checkRange(
  z.object({ employeeId: z.string().uuid(), ...rangeShape, includeMap: z.boolean().default(false) }),
);
export type CreateReportInput = z.output<typeof CreateReportSchema>;

export type ReportDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  from: string;
  to: string;
  status: ReportStatus;
  requestedBy: string;
  createdAt: string;
  generatedAt: string | null;
  expiresAt: string | null;
  byteSize: number | null;
  failureReason: string | null;
};

export const ReportsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReportsQuery = z.output<typeof ReportsQuerySchema>;
export type ReportsResponse = { items: ReportDto[]; page: number; pageSize: number; total: number };
