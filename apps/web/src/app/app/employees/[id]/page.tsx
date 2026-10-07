import type { EmployeeSummary, EmployeeUpdatesResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { OverviewCards } from '@/components/employee-detail/overview-cards';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { UpdatesList } from '@/components/employee-detail/updates-list';
import { pageRange, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeOverview({ params, searchParams }: Props) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const q = `from=${range.from}&to=${range.to}`;
  const [summary, latest] = await Promise.all([
    serverApi<EmployeeSummary>(`/employees/${id}/summary?${q}`),
    serverApi<EmployeeUpdatesResponse>(`/employees/${id}/updates?${q}&pageSize=5`),
  ]);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <OverviewCards summary={summary} />
      <Card>
        <h2 className="px-5 pt-5 text-lg">Latest updates</h2>
        <UpdatesList items={latest.items} timezone={me.company.timezone} />
      </Card>
    </div>
  );
}
