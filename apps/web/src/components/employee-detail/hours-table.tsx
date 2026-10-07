'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { type AdminSessionDto, type EmployeeSessionsResponse, sessionLabel } from '@worktrail/types';
import { formatMinutes } from '@/lib/format';

type Props = { data: EmployeeSessionsResponse; onClose?: (s: AdminSessionDto) => void };

export function HoursTable({ data, onClose }: Props) {
  const tz = data.timezone;
  const day = (iso: string) => formatInTimeZone(new Date(iso), tz, 'yyyy-MM-dd');
  const time = (iso: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');
  const label = (date: string) => formatInTimeZone(new Date(`${date}T12:00:00Z`), 'UTC', 'EEE d MMM');
  const stuck = data.sessions.filter((s) => s.leftRunning);

  return (
    <div className="space-y-4">
      {stuck.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold text-brand-700">Left running</span> · started {formatInTimeZone(new Date(s.startedAt), tz, 'EEE d MMM, h:mm a')}
            {s.lastLocationAt ? ` · last location ${formatInTimeZone(new Date(s.lastLocationAt), tz, 'EEE d MMM, h:mm a')}` : ''}
          </span>
          {onClose ? (
            <button type="button" onClick={() => onClose(s)} className="rounded-input bg-cta px-3 py-1.5 font-semibold text-white">
              Close session
            </button>
          ) : null}
        </div>
      ))}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-ink-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Day</th>
            <th scope="col" className="px-5 py-3 font-medium">Sessions</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">Hours</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.days.map((d) => {
            const sessions = data.sessions.filter((s) => day(s.startedAt) === d.date);
            return (
              <tr key={d.date}>
                <th scope="row" className="px-5 py-3 font-medium text-ink-900">{label(d.date)}</th>
                <td className="px-5 py-3 text-ink-700">
                  {sessions.length === 0 ? (
                    <span className="text-ink-300">—</span>
                  ) : (
                    sessions.map((s) => (
                      <span key={s.id} className="mr-3 inline-flex items-center gap-2">
                        {time(s.startedAt)} – {s.endedAt ? time(s.endedAt) : 'now'}
                        {s.status !== 'COMPLETED' ? (
                          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs">{sessionLabel(s)}</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-900">{d.minutes ? formatMinutes(d.minutes) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line font-semibold text-ink-900">
            <th scope="row" className="px-5 py-3">Total</th>
            <td />
            <td className="px-5 py-3 text-right tabular-nums">{formatMinutes(data.totalMinutes)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
