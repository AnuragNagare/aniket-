import type { Metadata } from 'next';
import type { DashboardResponse } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { getCurrentUser } from '@/lib/current-user';
import { serverApi } from '@/lib/server-api';
import { firstName, greeting } from '@/lib/format';
import { DatePicker } from '@/components/dashboard/date-picker';
import { KpiRow } from '@/components/dashboard/kpi-row';
import { LocationsCard } from '@/components/dashboard/locations-card';
import { RecentUpdates } from '@/components/dashboard/recent-updates';
import { WorkHours } from '@/components/dashboard/work-hours';

export const metadata: Metadata = { title: 'Dashboard · Work Trail' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardPage({ searchParams }: PageProps<'/app/dashboard'>) {
  const { date } = await searchParams;
  const query = typeof date === 'string' && ISO_DATE.test(date) ? `?date=${date}` : '';

  const [user, data] = await Promise.all([
    getCurrentUser(),
    serverApi<DashboardResponse>(`/dashboard${query}`),
  ]);
  const now = new Date();
  const today = formatInTimeZone(now, data.timezone, 'yyyy-MM-dd');
  const isToday = data.date === today;
  const dayLabel = isToday
    ? 'today'
    : `on ${formatInTimeZone(new Date(`${data.date}T12:00:00Z`), 'UTC', 'EEE, d MMM yyyy')}`;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight">
            {greeting(now, data.timezone)}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-ink-500">Here&apos;s how your field team is doing {dayLabel}.</p>
        </div>
        <DatePicker value={data.date} max={today} />
      </div>

      <KpiRow kpis={data.kpis} />
      <LocationsCard locations={data.locations} timezone={data.timezone} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentUpdates items={data.recentUpdates} timezone={data.timezone} />
        <WorkHours items={data.workHours} />
      </div>
    </div>
  );
}
