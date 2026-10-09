import type { Metadata } from 'next';
import Link from 'next/link';
import type { MeResponse, WorkSessionsResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { SessionsFilters } from '@/components/sessions/sessions-filters';
import { SessionsPanel } from '@/components/sessions/sessions-panel';
import { closeSession } from '../employees/[id]/actions';
import { pageRange, rangeQuery, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Work sessions · Work Trail' };

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function WorkSessionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(Promise.resolve(sp), me.company.timezone);
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;
  const qs = new URLSearchParams({
    from: range.from,
    to: range.to,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (typeof sp.status === 'string' && sp.status) qs.set('status', sp.status);
  if (typeof sp.q === 'string' && sp.q.trim()) qs.set('query', sp.q.trim());
  const data = await serverApi<WorkSessionsResponse>(`/work-sessions?${qs}`);

  const makeHref = (newPage: number) => {
    const base = rangeQuery(range);
    const statusPart = typeof sp.status === 'string' && sp.status ? `&status=${encodeURIComponent(sp.status)}` : '';
    const qPart = typeof sp.q === 'string' && sp.q.trim() ? `&q=${encodeURIComponent(sp.q.trim())}` : '';
    const pagePart = newPage > 1 ? `&page=${newPage}` : '';
    return `/app/sessions${base}${statusPart}${qPart}${pagePart}`;
  };

  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h1 className="text-[28px] leading-tight">Work sessions</h1>
        <p className="mt-1 text-ink-500">Every start and end of work in your company.</p>
      </div>
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="overflow-hidden p-0">
        <SessionsFilters
          range={range}
          status={typeof sp.status === 'string' ? sp.status : ''}
          q={typeof sp.q === 'string' ? sp.q : ''}
        />
        <SessionsPanel data={data} action={closeSession} />
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-500">
          <p>{data.total} sessions</p>
          {totalPages > 1 ? (
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={makeHref(page - 1)}
                  className="rounded-input border border-line px-3 py-1 text-ink-700 hover:bg-canvas"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={makeHref(page + 1)}
                  className="rounded-input border border-line px-3 py-1 text-ink-700 hover:bg-canvas"
                >
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
