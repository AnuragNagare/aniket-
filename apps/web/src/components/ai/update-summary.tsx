'use client';

import { useId } from 'react';
import { AI_LABEL, type WorkUpdateDto } from '@worktrail/types';
import { AiLabel } from './ai-label';

const LISTS = [
  ['activities', 'Activities'],
  ['issues', 'Issues'],
  ['followUps', 'Follow-ups'],
] as const;

export function UpdateSummary({
  update,
}: {
  update: Pick<WorkUpdateDto, 'summaryStatus' | 'aiSummary'>;
}) {
  const labelId = useId();
  if (update.summaryStatus === 'FAILED') {
    return <p className="mt-2 text-sm text-ink-500">Summary unavailable</p>;
  }
  if (!update.aiSummary) {
    return (
      <p aria-live="polite" className="mt-2 text-sm text-ink-500">
        Summarising…
      </p>
    );
  }
  const s = update.aiSummary;
  return (
    <div
      className="mt-2 rounded-input border border-line bg-canvas px-3 py-2.5 text-sm"
      aria-describedby={labelId}
    >
      <p className="text-ink-900">{s.summary}</p>
      {LISTS.filter(([k]) => s[k].length > 0).map(([k, label]) => (
        <div key={k} className="mt-1.5">
          <p className="text-xs font-semibold text-ink-500">{label}</p>
          <ul className="list-disc pl-5 text-ink-700">
            {s[k].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ))}
      <AiLabel compact id={labelId} />
      <span id={`${labelId}-full`} hidden>
        {AI_LABEL}
      </span>
    </div>
  );
}
