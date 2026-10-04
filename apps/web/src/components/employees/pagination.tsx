import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { employeesHref, type EmployeesQuery } from '@/lib/employees-query';

type Props = { query: EmployeesQuery; pageSize: number; total: number };

const linkClass =
  'grid size-9 place-items-center rounded-input border border-line text-ink-700 hover:bg-brand-50';

export function Pagination({ query, pageSize, total }: Props) {
  if (total === 0) return null;
  const from = (query.page - 1) * pageSize + 1;
  const to = Math.min(query.page * pageSize, total);
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-500"
    >
      <span>
        {from}–{to} of {total}
      </span>
      <span className="flex gap-2">
        {query.page > 1 ? (
          <Link href={employeesHref(query, { page: query.page - 1 })} aria-label="Previous page" className={linkClass}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
        {to < total ? (
          <Link href={employeesHref(query, { page: query.page + 1 })} aria-label="Next page" className={linkClass}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
