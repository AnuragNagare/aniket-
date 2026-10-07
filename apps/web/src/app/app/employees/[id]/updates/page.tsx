import Link from 'next/link';
import {
  UPDATE_CATEGORIES,
  UPDATE_CATEGORY_LABELS,
  type EmployeeUpdatesResponse,
  type MeResponse,
  type UpdateCategory,
} from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { UpdatesList } from '@/components/employee-detail/updates-list';
import { cn } from '@/lib/cn';
import { pageRange, rangeQuery, type SearchParams } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function EmployeeUpdatesPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);

  const categoryParam = typeof sp.category === 'string' ? sp.category : undefined;
  const category = (UPDATE_CATEGORIES as readonly string[]).includes(categoryParam ?? '')
    ? (categoryParam as UpdateCategory)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 50;

  const q = `from=${range.from}&to=${range.to}&page=${page}&pageSize=${pageSize}${category ? `&category=${category}` : ''}`;
  const data = await serverApi<EmployeeUpdatesResponse>(`/employees/${id}/updates?${q}`);

  const makeHref = (newCat?: string, newPage = 1) => {
    const base = rangeQuery(range);
    const catPart = newCat ? `&category=${newCat}` : '';
    const pagePart = newPage > 1 ? `&page=${newPage}` : '';
    return `/app/employees/${id}/updates${base}${catPart}${pagePart}`;
  };

  const totalPages = Math.ceil(data.total / pageSize);
  const startItem = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, data.total);

  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={makeHref(undefined, 1)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            !category ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-ink-700 hover:bg-canvas',
          )}
        >
          All categories
        </Link>
        {UPDATE_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={makeHref(cat, 1)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              category === cat
                ? 'bg-brand-500 text-white'
                : 'border border-line bg-surface text-ink-700 hover:bg-canvas',
            )}
          >
            {UPDATE_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <UpdatesList items={data.items} timezone={me.company.timezone} />
        {data.total > 0 ? (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-500">
            <span>
              Showing {startItem}–{endItem} of {data.total}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={makeHref(category, page - 1)}
                  className="rounded-input border border-line px-3 py-1 text-ink-700 hover:bg-canvas"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={makeHref(category, page + 1)}
                  className="rounded-input border border-line px-3 py-1 text-ink-700 hover:bg-canvas"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
