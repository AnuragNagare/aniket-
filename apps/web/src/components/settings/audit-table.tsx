import type { AuditLogItem } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';

type Props = {
  items: AuditLogItem[];
  timezone?: string;
};

export function AuditTable({ items, timezone = 'Asia/Kolkata' }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-input border border-dashed border-line p-12 text-center">
        <p className="text-sm font-medium text-ink-500">Nothing recorded in this period.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase text-ink-500">
            <th className="py-3 pr-4">Action</th>
            <th className="py-3 pr-4">Actor</th>
            <th className="py-3 pr-4">Target</th>
            <th className="py-3 pr-4">Date (IST)</th>
            <th className="py-3">IP address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => {
            const formattedDate = formatInTimeZone(
              new Date(item.createdAt),
              timezone,
              'd MMM yyyy, h:mm a',
            );
            const target =
              item.entityName ||
              (item.entityType !== 'company' && item.entityType !== 'user' ? item.entityType : null);

            return (
              <tr key={item.id} className="hover:bg-brand-50/50">
                <td className="py-3 pr-4">
                  <div className="font-medium text-ink-900">{item.label}</div>
                  {Object.keys(item.details).length > 0 && (
                    <div className="mt-0.5 text-xs text-ink-500">
                      {Object.entries(item.details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4 text-ink-700">
                  {item.actorName ?? <span className="text-ink-400">System</span>}
                </td>
                <td className="py-3 pr-4 text-ink-700">
                  {target ?? <span className="text-ink-400">—</span>}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap text-ink-700">{formattedDate}</td>
                <td className="py-3 whitespace-nowrap font-mono text-xs text-ink-500">
                  {item.ip ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
