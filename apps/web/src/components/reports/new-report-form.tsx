'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PRESETS, PRESET_LABELS, type Preset, presetRange } from '@/lib/date-range';
import { createCompanyReport } from '@/app/app/reports/actions';
import { cn } from '@/lib/cn';

type Props = {
  employees: Array<{ id: string; name: string; email: string | null }>;
  today?: string;
};

export function NewReportForm({ employees, today: initialToday }: Props) {
  const today = initialToday ?? new Date().toISOString().slice(0, 10);
  const [preset, setPreset] = useState<Preset>('this-week');
  const initial = presetRange('this-week', today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const [state, formAction, isPending] = useActionState(createCompanyReport, null);

  const selectPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p, today);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">New work report</h2>
      <p className="mt-1 text-sm text-ink-500">
        Generate a downloadable PDF work report for an employee over a selected period.
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="employeeId" className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
            Employee
          </label>
          <select
            id="employeeId"
            name="employeeId"
            required
            className="mt-1.5 w-full rounded-input border border-line bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>
              Select an employee…
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} {e.email ? `(${e.email})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
            Period
          </label>
          <div role="radiogroup" aria-label="Period" className="mt-1.5 flex flex-wrap gap-1 rounded-input border border-line bg-surface p-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                onClick={() => selectPreset(p)}
                className={cn(
                  'rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors',
                  preset === p ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-ink-700 font-medium">
            From
            <input
              type="date"
              name="from"
              value={from}
              max={today}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset('custom');
              }}
              required
              className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-ink-900"
            />
          </label>
          <label className="flex items-center gap-2 text-ink-700 font-medium">
            To
            <input
              type="date"
              name="to"
              value={to}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset('custom');
              }}
              required
              className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-ink-900"
            />
          </label>
        </div>

        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-danger-500">
            {state.error}
          </p>
        ) : null}

        <div className="pt-2">
          <Button type="submit" loading={isPending}>
            Generate PDF
          </Button>
        </div>
      </form>
    </Card>
  );
}
