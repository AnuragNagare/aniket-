import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { employeesHref, type EmployeesQuery, type StatusFilter } from '@/lib/employees-query';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'WORKING', label: 'Working' },
  { value: 'OFF_DUTY', label: 'Off duty' },
];

/** Search (a plain GET form, works without JavaScript) and status filter links. */
export function EmployeesToolbar({ query }: { query: EmployeesQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-5">
      <form
        action="/app/employees"
        className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-input border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-brand-500"
      >
        <Search className="size-[18px] text-ink-300" aria-hidden />
        <label htmlFor="employee-search" className="sr-only">
          Search employees by name
        </label>
        <input
          id="employee-search"
          name="q"
          defaultValue={query.query}
          placeholder="Search by name"
          className="h-full flex-1 bg-transparent text-sm outline-none"
        />
        {query.status !== 'ALL' ? <input type="hidden" name="status" value={query.status} /> : null}
      </form>
      <nav aria-label="Filter by status" className="flex gap-1 rounded-input border border-line bg-surface p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={employeesHref(query, { status: f.value })}
            aria-current={query.status === f.value ? 'page' : undefined}
            className={cn(
              'rounded-[9px] px-3 py-1.5 text-sm font-semibold',
              query.status === f.value ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
