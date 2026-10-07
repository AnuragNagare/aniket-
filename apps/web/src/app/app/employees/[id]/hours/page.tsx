import type { EmployeeSessionsResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { HoursPanel } from '@/components/employee-detail/hours-panel';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { pageRange, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';
import { closeSession } from '../actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeHours({ params, searchParams }: Props) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const data = await serverApi<EmployeeSessionsResponse>(`/employees/${id}/sessions?from=${range.from}&to=${range.to}`);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="overflow-hidden p-0 pt-2">
        <HoursPanel employeeId={id} data={data} action={closeSession} />
      </Card>
    </div>
  );
}
