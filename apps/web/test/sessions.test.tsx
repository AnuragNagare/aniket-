import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkSessionsResponse } from '@worktrail/types';
import { SessionsTable } from '@/components/sessions/sessions-table';

const data: WorkSessionsResponse = {
  timezone: 'Asia/Kolkata',
  page: 1,
  pageSize: 25,
  total: 2,
  items: [
    {
      id: 's1',
      employeeId: 'e1',
      employeeName: 'Amit Kumar',
      status: 'COMPLETED',
      startedAt: '2026-10-05T03:32:00.000Z',
      endedAt: '2026-10-05T12:40:00.000Z',
      totalMinutes: 548,
      lastLocationAt: null,
      pointCount: 110,
      leftRunning: false,
    },
    {
      id: 's2',
      employeeId: 'e2',
      employeeName: 'Vikram Rao',
      status: 'ACTIVE',
      startedAt: '2026-10-04T03:30:00.000Z',
      endedAt: null,
      totalMinutes: null,
      lastLocationAt: null,
      pointCount: 90,
      leftRunning: true,
    },
  ],
};

describe('SessionsTable', () => {
  it('shows each session with times, duration, locations and a clear status', () => {
    render(<SessionsTable data={data} />);
    const amit = screen.getByRole('row', { name: /Amit Kumar/ });
    expect(within(amit).getByText('Mon 5 Oct')).toBeInTheDocument();
    expect(within(amit).getByText('9:02 AM')).toBeInTheDocument();
    expect(within(amit).getByText('6:10 PM')).toBeInTheDocument();
    expect(within(amit).getByText('9h 8m')).toBeInTheDocument();
    expect(within(amit).getByText('110')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Vikram Rao/ })).getByText('Left running')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vikram Rao' })).toHaveAttribute('href', '/app/employees/e2/hours');
  });

  it('explains an empty result', () => {
    render(<SessionsTable data={{ ...data, items: [], total: 0 }} />);
    expect(screen.getByText('No work sessions in this period.')).toBeInTheDocument();
  });
});
