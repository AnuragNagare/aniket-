import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AI_LABEL, type PeriodSummaryDto, type ReportDto } from '@worktrail/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/app/employees/e1/reports',
  useSearchParams: () => new URLSearchParams('range=this-week'),
}));

import { PeriodReportCard } from '@/components/reports/period-report-card';
import { ReportsTable } from '@/components/reports/reports-table';

const done: PeriodSummaryDto = {
  id: 'g1',
  periodType: 'WEEKLY',
  from: '2026-10-05',
  to: '2026-10-11',
  status: 'COMPLETE',
  sourceUpdateCount: 7,
  sourceSessionMinutes: 1290,
  modelName: 'claude-opus-5-5',
  generatedAt: '2026-10-11T13:00:00.000Z',
  requestedAt: '2026-10-11T12:59:00.000Z',
  report: {
    overview: 'Seven updates across three days.',
    keyActivities: ['Installations at 2 clinics'],
    reportedIssues: ['Faulty sensor'],
    reportedFollowUps: ['Replace sensor'],
    dataNotes: ['1 gap in location data'],
  },
};

describe('PeriodReportCard', () => {
  it('shows the report sections and the AI label', () => {
    render(<PeriodReportCard summary={done} timezone="Asia/Kolkata" onCreate={vi.fn()} />);
    expect(screen.getByText('Seven updates across three days.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reported follow-ups' })).toBeInTheDocument();
    expect(screen.getByText(AI_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create again' })).toBeInTheDocument();
  });

  it('offers to create one when none exists', async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: true });
    render(<PeriodReportCard summary={null} timezone="Asia/Kolkata" onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create AI report' }));
    expect(onCreate).toHaveBeenCalledWith(false);
  });

  it('shows progress and failure states', () => {
    const { rerender } = render(
      <PeriodReportCard
        summary={{ ...done, status: 'QUEUED', report: null }}
        timezone="Asia/Kolkata"
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText('Creating report…')).toBeInTheDocument();
    rerender(
      <PeriodReportCard
        summary={{ ...done, status: 'FAILED', report: null }}
        timezone="Asia/Kolkata"
        onCreate={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Summary unavailable. The updates tab shows everything the employee wrote.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('ReportsTable', () => {
  const base: ReportDto = {
    id: 'r1',
    employeeId: 'e1',
    employeeName: 'Amit Kumar',
    from: '2026-10-05',
    to: '2026-10-11',
    status: 'READY',
    requestedBy: 'Priya Shah',
    createdAt: '2026-10-11T13:00:00.000Z',
    generatedAt: '2026-10-11T13:00:09.000Z',
    expiresAt: '2026-11-10T13:00:09.000Z',
    byteSize: 182_000,
    failureReason: null,
  };

  it('links ready reports to the protected download and labels other states', () => {
    render(
      <ReportsTable
        items={[
          base,
          { ...base, id: 'r2', status: 'GENERATING' },
          { ...base, id: 'r3', status: 'FAILED' },
        ]}
        timezone="Asia/Kolkata"
      />,
    );
    const ready = screen.getAllByRole('row')[1]!;
    expect(within(ready).getByRole('link', { name: /Download PDF/ })).toHaveAttribute(
      'href',
      '/api/reports/r1/download',
    );
    expect(within(ready).getByText('5–11 Oct 2026')).toBeInTheDocument();
    expect(within(ready).getByText('178 KB')).toBeInTheDocument();
    expect(screen.getByText('Preparing…')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('explains an empty history', () => {
    render(<ReportsTable items={[]} timezone="Asia/Kolkata" />);
    expect(
      screen.getByText('No PDF reports yet. Choose a period and select Download PDF.'),
    ).toBeInTheDocument();
  });
});
