import { Clock, CalendarDays, FileText, Route } from 'lucide-react';
import type { EmployeeSummary } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { formatMinutes } from '@/lib/format';

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <Card role="group" aria-label={label} className="p-5">
      <span className="grid size-10 place-items-center rounded-[10px] bg-brand-50 text-brand-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 font-display text-[28px] font-bold leading-none text-ink-900">{value}</p>
      <p className="mt-1 text-sm text-ink-500">{label}</p>
    </Card>
  );
}

export function OverviewCards({ summary }: { summary: EmployeeSummary }) {
  return (
    <div className="space-y-4">
      {summary.leftRunning ? (
        <p role="alert" className="rounded-input border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-900">
          A work session was left running. Open Work hours to close it at the right time.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Hours worked" value={formatMinutes(summary.totalMinutes)} icon={Clock} />
        <Stat label="Days worked" value={String(summary.daysWorked)} icon={CalendarDays} />
        <Stat label="Updates" value={String(summary.updateCount)} icon={FileText} />
        <Stat label="Distance covered" value={`${summary.distanceKm} km`} icon={Route} />
      </div>
    </div>
  );
}
