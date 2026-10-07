'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { DashboardResponse } from '@worktrail/types';
import { timeIn } from '@/lib/format';
import { Avatar } from './avatar';
import { SectionCard } from './section-card';

// MapLibre needs the browser (WebGL), so the map is loaded on the client only.
const LocationsMap = dynamic(() => import('./locations-map').then((m) => m.LocationsMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-input bg-brand-50" />,
});

type Props = { locations: DashboardResponse['locations']; timezone: string };

function lastSeen(l: Props['locations'][number], timezone: string) {
  if (!l.lastPoint) return 'No location yet';
  const state = l.status === 'WORKING' ? 'Working' : 'Off duty';
  return `${state} · last seen ${timeIn(l.lastPoint.capturedAt, timezone)}`;
}

export function LocationsCard({ locations, timezone }: Props) {
  const working = locations.filter((l) => l.status === 'WORKING').length;
  return (
    <SectionCard
      title="Last known locations"
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-500">
          <span className="size-2 rounded-full bg-success-500" aria-hidden />
          {working} working now
        </span>
      }
    >
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="h-[300px] overflow-hidden rounded-input">
          <LocationsMap locations={locations} />
        </div>
        {locations.length === 0 ? (
          <p className="text-sm text-ink-500">
            Employees appear here after you add them and they start work.
          </p>
        ) : (
          <ul className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
            {locations.map((l) => (
              <li key={l.employeeId} className="flex items-center gap-3">
                <Avatar name={l.name} size={32} />
                <div className="min-w-0">
                  <Link href={`/app/employees/${l.employeeId}`} className="truncate block text-sm font-semibold text-ink-900 hover:text-brand-700">
                    {l.name}
                  </Link>
                  <p className="text-xs text-ink-500">{lastSeen(l, timezone)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
