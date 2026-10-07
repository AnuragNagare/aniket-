import Link from 'next/link';
import { UPDATE_CATEGORY_LABELS, type DashboardResponse } from '@worktrail/types';
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
                <Link href={`/app/employees/${u.employeeId}`} className="text-sm font-semibold text-ink-900 hover:text-brand-700">
                  {u.employeeName}
                </Link>
                <p className="flex items-center gap-2 text-xs text-ink-500">
                  {timeIn(u.submittedAt, timezone)}
                  {u.category ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                      {UPDATE_CATEGORY_LABELS[u.category]}
                    </span>
                  ) : null}
                  {u.inputMethod === 'VOICE' ? <span className="rounded-full bg-canvas px-2 py-0.5">Voice</span> : null}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-700">{u.text}</p>
                {u.summary ? <p className="mt-1 line-clamp-1 text-xs text-ink-500">AI: {u.summary}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
