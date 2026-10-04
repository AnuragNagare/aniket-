import Link from 'next/link';
import type { EmployeeListItem } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';
import { StatusChip } from './status-chip';

type Props = {
  items: EmployeeListItem[];
  /** True when a search or status filter is applied (changes the empty-state copy). */
  filtered?: boolean;
  /** Extra control for people who haven't accepted their invite yet (e.g. resend). */
  pendingAction?: (employee: EmployeeListItem) => React.ReactNode;
};

function EmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      {filtered ? (
        <>
          <p className="text-ink-500">No employees match this search.</p>
          <Link href="/app/employees" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Clear filters
          </Link>
        </>
      ) : (
        <>
          <p className="mx-auto max-w-[44ch] text-ink-500">
            No employees yet. Invite your first employee to start tracking work sessions.
          </p>
          <Link
            href="/app/employees/new"
            className="mt-4 inline-flex h-11 items-center rounded-input bg-cta px-5 text-sm font-semibold text-white"
          >
            Invite employee
          </Link>
        </>
      )}
    </div>
  );
}

export function EmployeeTable({ items, filtered, pendingAction }: Props) {
  if (items.length === 0) return <EmptyState filtered={filtered} />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-ink-500">
        <tr>
          <th scope="col" className="px-5 py-3 font-medium">Name</th>
          <th scope="col" className="px-5 py-3 font-medium max-md:hidden">Employee ID</th>
          <th scope="col" className="px-5 py-3 font-medium max-md:hidden">Email</th>
          <th scope="col" className="px-5 py-3 font-medium">Status</th>
          <th scope="col" className="px-5 py-3">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((e) => (
          <tr key={e.id}>
            <th scope="row" className="px-5 py-3 font-normal">
              <span className="flex items-center gap-3">
                <Avatar name={e.name} size={32} />
                <span>
                  <span className="block font-semibold text-ink-900">{e.name}</span>
                  <span className="block text-xs text-ink-500">{e.designation ?? 'No designation'}</span>
                </span>
              </span>
            </th>
            <td className="px-5 py-3 text-ink-700 max-md:hidden">{e.employeeCode ?? '—'}</td>
            <td className="px-5 py-3 text-ink-700 max-md:hidden">{e.email ?? '—'}</td>
            <td className="px-5 py-3">
              <StatusChip employee={e} />
            </td>
            <td className="px-5 py-3 text-right">
              {e.account === 'INVITED' ? pendingAction?.(e) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
