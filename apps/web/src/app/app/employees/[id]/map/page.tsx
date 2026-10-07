import dynamic from 'next/dynamic';
import type { LocationTrailResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { TrailSummary } from '@/components/employee-detail/trail-summary';
import { pageRange, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

const TrailMap = dynamic(() => import('@/components/employee-detail/trail-map').then((m) => m.TrailMap), {
  loading: () => <div className="size-full animate-pulse rounded-input bg-brand-50" />,
});

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeMap({ params, searchParams }: Props) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const trail = await serverApi<LocationTrailResponse>(`/employees/${id}/location-trail?from=${range.from}&to=${range.to}`);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="space-y-4 p-5">
        <TrailSummary trail={trail} />
        <div className="h-[520px] overflow-hidden rounded-input">
          <TrailMap trail={trail} />
        </div>
        <p className="flex flex-wrap gap-4 text-xs text-ink-500">
          <span>Orange line: route</span>
          <span>Hollow dot: approximate location</span>
          <span>Dashed line: no location received</span>
          <span>S / E: start and end of work</span>
        </p>
      </Card>
    </div>
  );
}
