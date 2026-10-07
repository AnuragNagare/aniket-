import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeeSessionsResponse, EmployeeSummary, WorkUpdateDto } from '@worktrail/types';
import { AI_LABEL } from '@worktrail/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/employees/e1/hours',
  useSearchParams: () => new URLSearchParams('range=this-week'),
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

import { TabNav } from '@/components/employee-detail/tab-nav';
import { OverviewCards } from '@/components/employee-detail/overview-cards';
import { HoursTable } from '@/components/employee-detail/hours-table';
import { UpdatesList } from '@/components/employee-detail/updates-list';
import { CloseSessionDialog } from '@/components/employee-detail/close-session-dialog';
import { TrailSummary } from '@/components/employee-detail/trail-summary';

const TZ = 'Asia/Kolkata';

describe('employee detail', () => {
  it('tabs keep the chosen period and mark the current tab', () => {
    render(<TabNav id="e1" />);
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/app/employees/e1/map?range=this-week');
    expect(screen.getByRole('link', { name: 'Work hours' })).toHaveAttribute('aria-current', 'page');
  });

  it('overview cards show hours, days, updates and distance', () => {
    const summary: EmployeeSummary = { from: '2026-10-05', to: '2026-10-07', totalMinutes: 1290, daysWorked: 3, updateCount: 7, pointCount: 240, distanceKm: 18.4, lastSeenAt: null, leftRunning: true };
    render(<OverviewCards summary={summary} />);
    expect(within(screen.getByRole('group', { name: 'Hours worked' })).getByText('21h 30m')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Distance covered' })).getByText('18.4 km')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A work session was left running');
  });

  it('hours table shows each day, the sessions and a total, and offers to close a forgotten session', async () => {
    const onClose = vi.fn();
    const data: EmployeeSessionsResponse = {
      timezone: TZ,
      days: [{ date: '2026-10-05', minutes: 548 }, { date: '2026-10-06', minutes: 0 }],
      totalMinutes: 548,
      sessions: [
        { id: 's1', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null, pointCount: 110, leftRunning: false },
        { id: 's2', status: 'ACTIVE', startedAt: '2026-10-04T03:30:00.000Z', endedAt: null, totalMinutes: null, lastLocationAt: '2026-10-04T12:00:00.000Z', pointCount: 90, leftRunning: true },
      ],
    };
    render(<HoursTable data={data} onClose={onClose} />);
    const mon = screen.getByRole('row', { name: /Mon 5 Oct/ });
    expect(within(mon).getByText('9:02 AM – 6:10 PM')).toBeInTheDocument();
    expect(within(mon).getByText('9h 8m')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('9h 8m');
    expect(screen.getByText('Left running')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close session' }));
    expect(onClose).toHaveBeenCalledWith(data.sessions[1]);
  });

  it('updates list shows category, voice and full text', () => {
    const items: WorkUpdateDto[] = [{ id: 'u1', clientUpdateId: 'c1', sessionId: 's1', text: 'Completed installation. One sensor needs replacement.', inputMethod: 'VOICE', category: 'INSTALLATION', submittedAt: '2026-10-05T05:30:00.000Z', summaryStatus: 'QUEUED', aiSummary: null }];
    render(<UpdatesList items={items} timezone={TZ} />);
    expect(screen.getByText('Installation')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
    expect(screen.getByText('Mon 5 Oct · 11:00 AM')).toBeInTheDocument();
  });

  it('updates list invites a wider period when empty', () => {
    render(<UpdatesList items={[]} timezone={TZ} />);
    expect(screen.getByText('No updates in this period. Try a longer period, such as This week.')).toBeInTheDocument();
  });

  it('updates list renders COMPLETE AI summary with follow-ups, label, and hides empty lists', () => {
    const items: WorkUpdateDto[] = [
      {
        id: 'u1',
        clientUpdateId: 'c1',
        sessionId: 's1',
        text: 'Installed machine at Sai Kripa. Needs sensor replacement.',
        inputMethod: 'TYPED',
        category: 'INSTALLATION',
        submittedAt: '2026-10-05T05:30:00.000Z',
        summaryStatus: 'COMPLETE',
        aiSummary: {
          summary: 'Machine installed. Sensor replacement needed.',
          activities: ['Installation'],
          issues: [],
          followUps: ['Replace sensor'],
          confidence: 'HIGH',
        },
      },
    ];
    render(<UpdatesList items={items} timezone={TZ} />);
    expect(screen.getByText('Machine installed. Sensor replacement needed.')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Replace sensor')).toBeInTheDocument();
    expect(screen.queryByText('Issues')).toBeNull();
    expect(screen.getByTitle(AI_LABEL)).toBeInTheDocument();
  });

  it('updates list shows "Summarising…" when QUEUED/PROCESSING', () => {
    const items: WorkUpdateDto[] = [
      {
        id: 'u1',
        clientUpdateId: 'c1',
        sessionId: 's1',
        text: 'Checking clinic status.',
        inputMethod: 'TYPED',
        category: 'SITE_VISIT',
        submittedAt: '2026-10-05T05:30:00.000Z',
        summaryStatus: 'QUEUED',
        aiSummary: null,
      },
    ];
    render(<UpdatesList items={items} timezone={TZ} />);
    expect(screen.getByText('Summarising…')).toBeInTheDocument();
  });

  it('updates list shows "Summary unavailable" when FAILED and retains raw text', () => {
    const items: WorkUpdateDto[] = [
      {
        id: 'u1',
        clientUpdateId: 'c1',
        sessionId: 's1',
        text: 'Power outage at client site.',
        inputMethod: 'TYPED',
        category: 'SITE_VISIT',
        submittedAt: '2026-10-05T05:30:00.000Z',
        summaryStatus: 'FAILED',
        aiSummary: null,
      },
    ];
    render(<UpdatesList items={items} timezone={TZ} />);
    expect(screen.getByText('Summary unavailable')).toBeInTheDocument();
    expect(screen.getByText('Power outage at client site.')).toBeInTheDocument();
  });

  it('close dialog defaults to the last location time and shows server errors', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: 'Choose an end time between the start of the session and now.', fields: {} });
    render(<CloseSessionDialog employeeId="e1" session={{ id: 's2', startedAt: '2026-10-04T03:30:00.000Z', lastLocationAt: '2026-10-04T12:00:00.000Z' }} timezone={TZ} action={action} onDone={vi.fn()} />);
    expect(screen.getByLabelText('End time')).toHaveValue('2026-10-04T17:30');
    await userEvent.click(screen.getByRole('button', { name: 'Close session' }));
    expect(action).toHaveBeenCalledWith('e1', 's2', '2026-10-04T12:00:00.000Z');
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose an end time between the start of the session and now.');
  });

  it('trail summary counts locations, distance and gaps, and warns about accuracy and truncation', () => {
    const t = {
      timezone: TZ,
      sessions: [],
      points: [],
      truncated: true,
      gaps: [{ sessionId: 's1', from: '2026-10-05T07:40:00.000Z', to: '2026-10-05T08:22:00.000Z', minutes: 42 }],
      stats: { pointCount: 28, lowAccuracyCount: 9, gapCount: 1, distanceKm: 3.4 },
    };
    render(<TrailSummary trail={t as never} />);
    expect(screen.getByText('28 locations · 3.4 km · 1 gap')).toBeInTheDocument();
    expect(screen.getByText('Some locations are approximate (accuracy worse than 100 m).')).toBeInTheDocument();
    expect(screen.getByText('Showing the first 5,000 locations. Choose a shorter period to see all of them.')).toBeInTheDocument();
    expect(screen.getByText('No location for 42 min · 1:10 PM – 1:52 PM')).toBeInTheDocument();
  });

  it('trail summary explains an empty period', () => {
    render(
      <TrailSummary
        trail={{
          timezone: TZ,
          sessions: [],
          points: [],
          gaps: [],
          truncated: false,
          stats: { pointCount: 0, lowAccuracyCount: 0, gapCount: 0, distanceKm: 0 },
        }}
      />,
    );
    expect(screen.getByText('No locations recorded in this period.')).toBeInTheDocument();
  });
});
