import { describe, expect, it } from 'vitest';
import { AI_LABEL, CreateReportSchema, PeriodReportSchema, UpdateSummarySchema, periodTypeFor } from '../src/index.js';

describe('AI output schemas (ai-prompts.pdf)', () => {
  const ok = { summary: 'Installed one unit.', activities: ['Installation'], issues: [], followUps: ['Replace sensor'], confidence: 'HIGH' };

  it('accepts the per-update shape and rejects extras, long summaries and bad confidence', () => {
    expect(UpdateSummarySchema.parse(ok)).toEqual(ok);
    expect(UpdateSummarySchema.safeParse({ ...ok, mood: 'happy' }).success).toBe(false);
    expect(UpdateSummarySchema.safeParse({ ...ok, summary: 'x'.repeat(281) }).success).toBe(false);
    expect(UpdateSummarySchema.safeParse({ ...ok, confidence: 'SURE' }).success).toBe(false);
  });

  it('accepts the period-report shape with a 600-character overview cap', () => {
    const r = { overview: 'Worked 3 days.', keyActivities: [], reportedIssues: [], reportedFollowUps: [], dataNotes: ['2 gaps'] };
    expect(PeriodReportSchema.parse(r)).toEqual(r);
    expect(PeriodReportSchema.safeParse({ ...r, overview: 'x'.repeat(601) }).success).toBe(false);
  });

  it('names the period', () => {
    expect(periodTypeFor('2026-10-05', '2026-10-05')).toBe('DAILY');
    expect(periodTypeFor('2026-09-28', '2026-10-04')).toBe('WEEKLY'); // Mon–Sun
    expect(periodTypeFor('2026-09-01', '2026-09-30')).toBe('MONTHLY');
    expect(periodTypeFor('2026-09-29', '2026-10-04')).toBe('CUSTOM');
  });

  it('report requests use the shared range rules', () => {
    const id = '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f';
    expect(CreateReportSchema.parse({ employeeId: id, from: '2026-10-01', to: '2026-10-04' })).toMatchObject({ includeMap: false });
    expect(CreateReportSchema.safeParse({ employeeId: id, from: '2026-08-01', to: '2026-10-04' }).success).toBe(false);
  });

  it('has one label everywhere', () => {
    expect(AI_LABEL).toBe('AI-generated summary based on submitted work updates and recorded work-session data.');
  });
});
