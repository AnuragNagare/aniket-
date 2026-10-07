import { describe, expect, it } from 'vitest';
import { AI_LABEL, type AdminSessionDto, type WorkUpdateDto, type PeriodSummaryDto } from '@worktrail/types';
import { renderReportHtml, type ReportData } from '../../src/modules/reports/pdf/report-html.js';

describe('renderReportHtml', () => {
  const baseData: ReportData = {
    company: { name: 'Acme Health India', timezone: 'Asia/Kolkata' },
    employee: {
      id: 'e1111111-1111-1111-1111-111111111111',
      name: 'Amit Kumar',
      email: 'amit@acme.com',
      phone: '+919876543210',
      designation: 'Senior Field Engineer',
      employeeCode: 'EMP-001',
    },
    from: '2026-10-05',
    to: '2026-10-05',
    periodLabel: '5 Oct 2026',
    generatedAt: '2026-10-05T12:00:00.000Z',
    totals: {
      totalMinutes: 480,
      daysWorked: 1,
      sessionCount: 1,
      updateCount: 2,
      pointCount: 150,
      distanceKm: 14.2,
      gapCount: 1,
    },
    sessions: [
      {
        id: 's1',
        startedAt: '2026-10-05T03:32:00.000Z', // 9:02 AM IST
        endedAt: '2026-10-05T11:32:00.000Z',   // 5:02 PM IST
        totalMinutes: 480,
        lastLocationAt: null,
        status: 'COMPLETED',
        startedAtClient: '2026-10-05T03:32:00.000Z',
        endedAtClient: '2026-10-05T11:32:00.000Z',
        pointCount: 150,
        leftRunning: false,
      } as AdminSessionDto,
    ],
    updates: [
      {
        id: 'u1',
        clientUpdateId: 'c1',
        sessionId: 's1',
        text: 'Installed unit at Sai Kripa Clinic.',
        category: 'INSTALLATION',
        inputMethod: 'TYPED',
        submittedAt: '2026-10-05T03:32:00.000Z', // 9:02 AM IST
        summaryStatus: 'COMPLETE',
        aiSummary: {
          summary: 'Unit installed at clinic.',
          activities: ['Installation'],
          issues: [],
          followUps: [],
          confidence: 'HIGH',
        },
      } as WorkUpdateDto,
      {
        id: 'u2',
        clientUpdateId: 'c2',
        sessionId: 's1',
        text: 'Patient monitor inspection completed.',
        category: 'SITE_VISIT',
        inputMethod: 'VOICE',
        submittedAt: '2026-10-05T05:00:00.000Z',
        summaryStatus: 'COMPLETE',
        aiSummary: null,
      } as WorkUpdateDto,
    ],
    summary: {
      id: 'sum1',
      periodType: 'DAILY',
      from: '2026-10-05',
      to: '2026-10-05',
      status: 'COMPLETE',
      report: {
        overview: 'Completed installation and inspection.',
        keyActivities: ['Installation at Sai Kripa Clinic'],
        reportedIssues: [],
        reportedFollowUps: ['Follow up with clinic manager'],
        dataNotes: ['1 data gap observed'],
      },
      sourceUpdateCount: 2,
      sourceSessionMinutes: 480,
      modelName: 'claude-opus-5-5',
      generatedAt: '2026-10-05T12:00:00.000Z',
      requestedAt: '2026-10-05T11:59:00.000Z',
    } as PeriodSummaryDto,
    notes: [],
  };

  it('includes company name, employee name, period label, Hours worked, sessions, and update text', () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain('Acme Health India');
    expect(html).toContain('Amit Kumar');
    expect(html).toContain('5 Oct 2026');
    expect(html).toContain('Hours worked');
    expect(html).toContain('8h 0m');
    expect(html).toContain('Installed unit at Sai Kripa Clinic.');
    expect(html).toContain('Patient monitor inspection completed.');
    expect(html).toContain('Voice');
  });

  it('shows AI_LABEL in the AI section and in the footer', () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain(AI_LABEL);
    const matches = html.split(AI_LABEL).length - 1;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it('shows "Summary unavailable" when summary is null or FAILED', () => {
    const withoutSummary = { ...baseData, summary: null };
    const html1 = renderReportHtml(withoutSummary);
    expect(html1).toContain('Summary unavailable');

    const failedSummary = {
      ...baseData,
      summary: { ...baseData.summary!, status: 'FAILED', report: null } as PeriodSummaryDto,
    };
    const html2 = renderReportHtml(failedSummary);
    expect(html2).toContain('Summary unavailable');
  });

  it('escapes scripts and HTML entities and contains no script tags', () => {
    const hostileData: ReportData = {
      ...baseData,
      updates: [
        {
          id: 'u-evil',
          clientUpdateId: 'c-evil',
          sessionId: 's1',
          text: '<script>alert(1)</script><img src=x onerror=1>',
          category: 'SITE_VISIT',
          inputMethod: 'TYPED',
          submittedAt: '2026-10-05T03:32:00.000Z',
          summaryStatus: 'COMPLETE',
          aiSummary: null,
        } as WorkUpdateDto,
      ],
    };
    const html = renderReportHtml(hostileData);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
    expect(html).not.toContain('<script');
  });

  it('contains no external http:// or https:// URLs', () => {
    const html = renderReportHtml(baseData);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('renders times in company timezone (IST)', () => {
    const html = renderReportHtml(baseData);
    // 03:32 UTC is 9:02 AM IST
    expect(html).toContain('9:02 AM');
  });

  it('labels "Distance (estimate)" as an estimate', () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain('Distance (estimate)');
  });
});
