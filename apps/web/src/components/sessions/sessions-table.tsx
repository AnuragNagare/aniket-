import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { sessionLabel, type WorkSessionsResponse } from '@worktrail/types';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/format';

const TONE: Record<string, string> = {
  Active: 'bg-success-50 text-success-500',
  'Left running': 'bg-brand-50 text-brand-700',
  Completed: 'bg-canvas text-ink-500',
  'Closed by admin': 'bg-canvas text-ink-700',
};

export function SessionsTable({ data }: { data: WorkSessionsResponse }) {
  const tz = data.timezone;
  const f = (iso: string, p: string) => formatInTimeZone(new Date(iso), tz, p);
  if (data.items.length === 0) return <p className="px-5 py-10 text-center text-ink-500">No work sessions in this period.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-ink-500">
        <tr>
          {['Employee', 'Date', 'Start', 'End', 'Duration', 'Locations', 'Status'].map((h) => (
            <th key={h} scope="col" className="px-5 py-3 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.items.map((s) => {
          const label = sessionLabel(s);
          // eslint-disable-next-line react-hooks/purity -- elapsed duration for active sessions
          const minutes = s.totalMinutes ?? Math.round((Date.now() - Date.parse(s.startedAt)) / 60_000);
          return (
            <tr key={s.id}>
              <th scope="row" className="px-5 py-3 font-normal">
                <Link
                  href={`/app/employees/${s.employeeId}/hours`}
                  className="font-semibold text-ink-900 hover:text-brand-700"
                >
                  {s.employeeName}
                </Link>
              </th>
              <td className="px-5 py-3">{f(s.startedAt, 'EEE d MMM')}</td>
              <td className="px-5 py-3">{f(s.startedAt, 'h:mm a')}</td>
              <td className="px-5 py-3">{s.endedAt ? f(s.endedAt, 'h:mm a') : '—'}</td>
              <td className="px-5 py-3 tabular-nums">{minutes != null ? formatMinutes(minutes) : '—'}</td>
              <td className="px-5 py-3 tabular-nums">{s.pointCount}</td>
              <td className="px-5 py-3">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', TONE[label])}>{label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
