import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '@worktrail/types';

vi.mock('@/components/dashboard/locations-map', () => ({
  LocationsMap: () => <div data-testid="map" />,
}));

import { KpiRow } from '@/components/dashboard/kpi-row';
import { RecentUpdates } from '@/components/dashboard/recent-updates';
import { WorkHours } from '@/components/dashboard/work-hours';
import { LocationsCard } from '@/components/dashboard/locations-card';

const data: DashboardResponse = {
  date: '2026-10-04',
  timezone: 'Asia/Kolkata',
  kpis: {
    totalEmployees: 28,
    workingNow: 12,
    checkedInToday: 15,
    workMinutesToday: 5190,
    workMinutesYesterday: 4800,
    updatesToday: 24,
    updatesYesterday: 20,
  },
  locations: [
    {
      employeeId: 'a',
      name: 'Amit Kumar',
      designation: 'Field Sales',
      status: 'WORKING',
      lastPoint: { latitude: 19.07, longitude: 72.87, capturedAt: '2026-10-04T04:54:00Z' },
    },
    { employeeId: 'b', name: 'Neha Patel', designation: null, status: 'OFF_DUTY', lastPoint: null },
  ],
  recentUpdates: [
    {
      id: 'u',
      employeeId: 'a',
      employeeName: 'Amit Kumar',
      text: 'Completed site visit.',
      submittedAt: '2026-10-04T04:48:00Z',
    },
  ],
  workHours: [
    { employeeId: 'a', name: 'Amit Kumar', minutes: 384 },
    { employeeId: 'c', name: 'Rohit Singh', minutes: 192 },
  ],
};

describe('dashboard sections', () => {
  it('KPIs show values and only meaningful trends', () => {
    render(<KpiRow kpis={data.kpis} />);
    const hours = screen.getByRole('group', { name: 'Total work hours' });
    expect(within(hours).getByText('86h')).toBeInTheDocument();
    expect(within(hours).getByText('8% vs yesterday')).toBeInTheDocument();
    const working = screen.getByRole('group', { name: 'Working now' });
    expect(within(working).getByText('12')).toBeInTheDocument();
    expect(within(working).getByText('15 checked in today')).toBeInTheDocument();
  });

  it('hides the trend when yesterday had nothing to compare with', () => {
    render(<KpiRow kpis={{ ...data.kpis, updatesYesterday: 0 }} />);
    const updates = screen.getByRole('group', { name: 'Updates today' });
    expect(within(updates).queryByText(/vs yesterday/)).toBeNull();
  });

  it('says "Same as yesterday" instead of an up-arrow 0%', () => {
    render(<KpiRow kpis={{ ...data.kpis, updatesToday: 20, updatesYesterday: 20 }} />);
    const updates = screen.getByRole('group', { name: 'Updates today' });
    expect(within(updates).getByText('Same as yesterday')).toBeInTheDocument();
    expect(within(updates).queryByText('↑')).toBeNull();
  });

  it('recent updates show name, local time and text', () => {
    render(<RecentUpdates items={data.recentUpdates} timezone="Asia/Kolkata" />);
    expect(screen.getByText('Amit Kumar')).toBeInTheDocument();
    expect(screen.getByText('10:18 AM')).toBeInTheDocument();
    expect(screen.getByText('Completed site visit.')).toBeInTheDocument();
  });

  it('work hours bars are relative to the longest day', () => {
    render(<WorkHours items={data.workHours} />);
    expect(screen.getByRole('progressbar', { name: 'Amit Kumar' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByRole('progressbar', { name: 'Rohit Singh' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('6h 24m')).toBeInTheDocument();
  });

  it('locations card lists people with their last point and never says live', () => {
    render(<LocationsCard locations={data.locations} timezone="Asia/Kolkata" />);
    expect(screen.getByText('Last known locations')).toBeInTheDocument();
    expect(screen.getByText('Working · last seen 10:24 AM')).toBeInTheDocument();
    expect(screen.getByText('No location yet')).toBeInTheDocument();
    expect(screen.queryByText(/live/i)).toBeNull();
  });

  it('empty states point to what happens next', () => {
    render(<RecentUpdates items={[]} timezone="Asia/Kolkata" />);
    expect(
      screen.getByText('No updates yet. They appear here as soon as your team submits them.'),
    ).toBeInTheDocument();
  });
});
