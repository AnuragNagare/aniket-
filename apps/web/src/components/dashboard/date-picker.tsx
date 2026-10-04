'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

/** Picks which day the dashboard shows (kept in the URL as ?date=YYYY-MM-DD). */
export function DatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex h-11 items-center gap-2 rounded-input border border-line bg-surface px-3 text-sm text-ink-700 focus-within:ring-2 focus-within:ring-brand-500">
      <CalendarDays className="size-[18px] text-ink-300" aria-hidden />
      <span className="sr-only">Show the dashboard for</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => {
          const date = e.target.value;
          if (date) router.replace(date === max ? '/app/dashboard' : `/app/dashboard?date=${date}`);
        }}
        className="bg-transparent outline-none"
      />
    </label>
  );
}
