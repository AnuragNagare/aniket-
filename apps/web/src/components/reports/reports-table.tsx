import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import type { ReportDto } from '@worktrail/types';

function formatRange(from: string, to: string, tz: string): string {
  const f = new Date(`${from}T12:00:00Z`);
  const t = new Date(`${to}T12:00:00Z`);
  if (from === to) return formatInTimeZone(f, tz, 'd MMM yyyy');
  const sameMonth = f.getUTCFullYear() === t.getUTCFullYear() && f.getUTCMonth() === t.getUTCMonth();
  if (sameMonth) {
    return `${formatInTimeZone(f, tz, 'd')}–${formatInTimeZone(t, tz, 'd MMM yyyy')}`;
  }
  return `${formatInTimeZone(f, tz, 'd MMM')} – ${formatInTimeZone(t, tz, 'd MMM yyyy')}`;
}

type Props = {
  items: ReportDto[];
  timezone: string;
  showEmployee?: boolean;
};

export function ReportsTable({ items, timezone, showEmployee = false }: Props) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-500">
        No PDF reports yet. Choose a period and select Download PDF.
      </p>
    );
  }

  const now = new Date();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-500">
            <th className="px-5 py-3 font-semibold">Period</th>
            {showEmployee && <th className="px-5 py-3 font-semibold">Employee</th>}
            <th className="px-5 py-3 font-semibold">Requested by</th>
            <th className="px-5 py-3 font-semibold">Created</th>
            <th className="px-5 py-3 font-semibold">Size</th>
            <th className="px-5 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r) => {
            const isExpired = r.expiresAt && new Date(r.expiresAt) < now;
            const sizeLabel = r.byteSize ? `${Math.round(r.byteSize / 1024)} KB` : '—';
            const createdStr = formatInTimeZone(new Date(r.createdAt), timezone, 'd MMM, h:mm a');

            return (
              <tr key={r.id} className="hover:bg-canvas/50">
                <td className="px-5 py-4 font-medium text-ink-900">
                  {formatRange(r.from, r.to, timezone)}
                </td>
                {showEmployee && (
                  <td className="px-5 py-4 text-ink-800">
                    <Link
                      href={`/app/employees/${r.employeeId}/reports`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {r.employeeName}
                    </Link>
                  </td>
                )}
                <td className="px-5 py-4 text-ink-600">{r.requestedBy}</td>
                <td className="px-5 py-4 text-ink-500">{createdStr}</td>
                <td className="px-5 py-4 text-ink-500">{sizeLabel}</td>
                <td className="px-5 py-4 text-right">
                  {isExpired ? (
                    <span className="text-xs font-medium text-ink-400">Expired</span>
                  ) : r.status === 'READY' ? (
                    <a
                      href={`/api/reports/${r.id}/download`}
                      download
                      className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Download PDF
                    </a>
                  ) : r.status === 'FAILED' ? (
                    <span className="text-xs font-medium text-danger">Failed</span>
                  ) : (
                    <span className="text-xs font-medium text-ink-500">Preparing…</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
