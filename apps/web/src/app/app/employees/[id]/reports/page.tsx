import type { MeResponse, PeriodSummaryDto, ReportsResponse } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { AutoRefresh } from '@/components/reports/auto-refresh';
import { PeriodReportCard } from '@/components/reports/period-report-card';
import { ReportsTable } from '@/components/reports/reports-table';
import { pageRange, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';
import { createReport, createSummary } from './actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeReports({ params, searchParams }: Props) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const q = `from=${range.from}&to=${range.to}`;

  const [summary, reports] = await Promise.all([
    serverApi<PeriodSummaryDto | null>(`/employees/${id}/summaries?${q}`),
    serverApi<ReportsResponse>(`/reports?employeeId=${id}`),
  ]);

  const pending =
    summary?.status === 'QUEUED' ||
    summary?.status === 'PROCESSING' ||
    reports.items.some((r) => r.status === 'QUEUED' || r.status === 'GENERATING');

  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <PeriodReportCard
        summary={summary}
        timezone={me.company.timezone}
        onCreate={createSummary.bind(null, id, range.from, range.to)}
      />
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink-900">PDF reports</h2>
          <form action={createReport.bind(null, id, range.from, range.to)}>
            <Button type="submit">Download PDF · {range.label}</Button>
          </form>
        </div>
        <ReportsTable items={reports.items} timezone={me.company.timezone} />
      </Card>
      <AutoRefresh active={pending} />
    </div>
  );
}
