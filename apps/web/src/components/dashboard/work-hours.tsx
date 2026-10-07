import Link from 'next/link';
import type { DashboardResponse } from '@worktrail/types';
import { formatMinutes } from '@/lib/format';
import { Avatar } from './avatar';
import { SectionCard } from './section-card';

const MAX_ROWS = 6;

export function WorkHours({ items }: { items: DashboardResponse['workHours'] }) {
  const longest = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <SectionCard title="Today's work hours" action={{ href: '/app/sessions', label: 'View details' }}>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">
          No one has started work yet. Hours appear once a session starts.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.slice(0, MAX_ROWS).map((w) => {
            const pct = Math.round((w.minutes / longest) * 100);
            return (
              <li key={w.employeeId} className="flex items-center gap-3">
                <Avatar name={w.name} size={32} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <Link href={`/app/employees/${w.employeeId}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {w.name}
                    </Link>
                    <span className="text-ink-500">{formatMinutes(w.minutes)}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={w.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="mt-1.5 h-1.5 rounded-full bg-brand-50"
                  >
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
