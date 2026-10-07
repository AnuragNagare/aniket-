import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EmployeeListResponse, MeResponse, ReportsResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { AutoRefresh } from '@/components/reports/auto-refresh';
import { NewReportForm } from '@/components/reports/new-report-form';
import { ReportsTable } from '@/components/reports/reports-table';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Reports · Work Trail' };

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams: Promise<SearchParams>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const pageParam = Number.parseInt(first(sp.page), 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [me, employees, reports] = await Promise.all([
    serverApi<MeResponse>('/me'),
    serverApi<EmployeeListResponse>('/employees?pageSize=100'),
    serverApi<ReportsResponse>(`/reports?page=${page}&pageSize=25`),
  ]);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: me.company.timezone }).format(new Date());
  const pending = reports.items.some((r) => r.status === 'QUEUED' || r.status === 'GENERATING');

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ink-900">Reports</h1>
        <p className="mt-1 text-ink-500">
          PDF work reports for your team. Files are kept for 30 days.
        </p>
      </div>

      <NewReportForm employees={employees.items} today={today} />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink-900">Generated reports</h2>
        </div>
        <ReportsTable items={reports.items} timezone={me.company.timezone} showEmployee />
        {reports.total > 0 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-500"
          >
            <span>
              {(reports.page - 1) * reports.pageSize + 1}–
              {Math.min(reports.page * reports.pageSize, reports.total)} of {reports.total}
            </span>
            <span className="flex gap-2">
              {reports.page > 1 ? (
                <Link
                  href={`/app/reports?page=${reports.page - 1}`}
                  aria-label="Previous page"
                  className="grid size-9 place-items-center rounded-input border border-line text-ink-700 hover:bg-brand-50"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
              ) : null}
              {reports.page * reports.pageSize < reports.total ? (
                <Link
                  href={`/app/reports?page=${reports.page + 1}`}
                  aria-label="Next page"
                  className="grid size-9 place-items-center rounded-input border border-line text-ink-700 hover:bg-brand-50"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </span>
          </nav>
        )}
      </Card>
      <AutoRefresh active={pending} />
    </div>
  );
}
