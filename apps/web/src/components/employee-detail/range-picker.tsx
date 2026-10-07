'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { PRESET_LABELS, PRESETS, type Preset, rangeQuery } from '@/lib/date-range';

type Props = { value: { preset: Preset; from: string; to: string }; today: string; error?: string | null };

export function RangePicker({ value, today, error }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const go = (preset: Preset, f = from, t = to) => router.replace(`${path}${rangeQuery({ preset, from: f, to: t })}`);

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-1 rounded-input border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value.preset === p}
            onClick={() => (p === 'custom' ? go('custom') : go(p))}
            className={cn('rounded-[9px] px-3 py-1.5 text-sm font-semibold', value.preset === p ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900')}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {value.preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">From <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="rounded-input border border-line px-2 py-1" /></label>
          <label className="flex items-center gap-2">To <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="rounded-input border border-line px-2 py-1" /></label>
          <button type="button" onClick={() => go('custom', from, to)} className="rounded-input bg-cta px-3 py-1.5 font-semibold text-white">Show</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
