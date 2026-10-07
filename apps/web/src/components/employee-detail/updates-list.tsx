import { formatInTimeZone } from 'date-fns-tz';
import { UPDATE_CATEGORY_LABELS, type WorkUpdateDto } from '@worktrail/types';
import { UpdateSummary } from '../ai/update-summary';

export function UpdatesList({ items, timezone }: { items: WorkUpdateDto[]; timezone: string }) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-ink-500">No updates in this period. Try a longer period, such as This week.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((u) => (
        <li key={u.id} className="px-5 py-4">
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
            {formatInTimeZone(new Date(u.submittedAt), timezone, 'EEE d MMM · h:mm a')}
            {u.category ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                {UPDATE_CATEGORY_LABELS[u.category]}
              </span>
            ) : null}
            {u.inputMethod === 'VOICE' ? <span className="rounded-full bg-canvas px-2 py-0.5">Voice</span> : null}
          </p>
          <p className="mt-1.5 max-w-[75ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-900">{u.text}</p>
          <UpdateSummary update={u} />
        </li>
      ))}
    </ul>
  );
}
