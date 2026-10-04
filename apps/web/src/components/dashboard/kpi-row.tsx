import { Clock, FileText, MapPin, Users, type LucideIcon } from 'lucide-react';
import type { DashboardResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { formatHours, percentChange } from '@/lib/format';

type Kpis = DashboardResponse['kpis'];

function Trend({ value }: { value: number | null }) {
  if (value === null) return null;
  if (value === 0) return <span className="text-ink-500">Same as yesterday</span>;
  const up = value > 0;
  return (
    <span className={up ? 'text-success-500' : 'text-ink-500'}>
      <span aria-hidden>{up ? '↑ ' : '↓ '}</span>
      <span>{Math.abs(value)}% vs yesterday</span>
    </span>
  );
}

function Kpi(props: { label: string; icon: LucideIcon; value: string; foot: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <Card role="group" aria-label={props.label} className="p-5">
      <span className="grid size-10 place-items-center rounded-[10px] bg-brand-50 text-brand-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 font-display text-[32px] font-bold leading-none text-ink-900">
        {props.value}
      </p>
      <p className="mt-1 text-sm text-ink-500">{props.label}</p>
      <p className="mt-3 min-h-4 text-xs font-medium">{props.foot}</p>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Kpi
        label="Total employees"
        icon={Users}
        value={String(kpis.totalEmployees)}
        foot={<span className="text-ink-500">In your company</span>}
      />
      <Kpi
        label="Working now"
        icon={MapPin}
        value={String(kpis.workingNow)}
        foot={
          <span className="inline-flex items-center gap-1.5 text-ink-500">
            <span className="size-2 rounded-full bg-success-500" aria-hidden />
            {kpis.checkedInToday} checked in today
          </span>
        }
      />
      <Kpi
        label="Total work hours"
        icon={Clock}
        value={formatHours(kpis.workMinutesToday)}
        foot={<Trend value={percentChange(kpis.workMinutesToday, kpis.workMinutesYesterday)} />}
      />
      <Kpi
        label="Updates today"
        icon={FileText}
        value={String(kpis.updatesToday)}
        foot={<Trend value={percentChange(kpis.updatesToday, kpis.updatesYesterday)} />}
      />
    </div>
  );
}
