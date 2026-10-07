import { describe, expect, it } from 'vitest';
import {
  CloseSessionSchema,
  DateRangeSchema,
  EmployeeUpdatesQuerySchema,
  HistoryQuerySchema,
  WorkSessionsQuerySchema,
  sessionLabel,
} from '../src/index.js';

describe('ranges', () => {
  it('shares one rule set between history, updates and work sessions', () => {
    for (const s of [DateRangeSchema, HistoryQuerySchema, EmployeeUpdatesQuerySchema, WorkSessionsQuerySchema]) {
      expect(s.safeParse({ from: '2026-10-06', to: '2026-10-01' }).error?.issues[0]?.message).toBe('The end date must be on or after the start date.');
      expect(s.safeParse({ from: '2026-08-01', to: '2026-10-06' }).error?.issues[0]?.message).toBe('Choose at most 31 days.');
    }
  });

  it('coerces paging from query strings and applies defaults', () => {
    expect(EmployeeUpdatesQuerySchema.parse({ from: '2026-10-01', to: '2026-10-07', page: '2' })).toMatchObject({ page: 2, pageSize: 50 });
    expect(WorkSessionsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-07' })).toMatchObject({ page: 1, pageSize: 25 });
    expect(WorkSessionsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', pageSize: '500' }).success).toBe(false);
  });

  it('rejects an unknown status or category filter', () => {
    expect(WorkSessionsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', status: 'LOST' }).success).toBe(false);
    expect(EmployeeUpdatesQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', category: 'PARTY' }).success).toBe(false);
  });
});

describe('sessionLabel', () => {
  it.each([
    [{ status: 'ACTIVE', leftRunning: false }, 'Active'],
    [{ status: 'ACTIVE', leftRunning: true }, 'Left running'],
    [{ status: 'COMPLETED', leftRunning: false }, 'Completed'],
    [{ status: 'INCOMPLETE', leftRunning: false }, 'Closed by admin'],
  ] as const)('%o → %s', (s, label) => {
    expect(sessionLabel(s)).toBe(label);
  });
});

describe('CloseSessionSchema', () => {
  it('needs an ISO end time', () => {
    expect(CloseSessionSchema.safeParse({ endedAt: 'yesterday' }).success).toBe(false);
  });
});
