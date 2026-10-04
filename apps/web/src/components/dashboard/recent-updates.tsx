import type { DashboardResponse } from '@worktrail/types';
import { timeIn } from '@/lib/format';
import { Avatar } from './avatar';
import { SectionCard } from './section-card';

type Props = { items: DashboardResponse['recentUpdates']; timezone: string };

export function RecentUpdates({ items, timezone }: Props) {
  return (
    <SectionCard title="Recent updates" action={{ href: '/app/employees', label: 'View all' }}>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">
          No updates yet. They appear here as soon as your team submits them.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((u) => (
            <li key={u.id} className="flex gap-3 py-3">
              <Avatar name={u.employeeName} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">{u.employeeName}</p>
                <p className="text-xs text-ink-500">{timeIn(u.submittedAt, timezone)}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-700">{u.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
