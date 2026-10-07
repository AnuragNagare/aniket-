import type { Preset } from '@/lib/date-range';

type Props = {
  range: { preset: Preset; from: string; to: string };
  status?: string;
  q?: string;
};

export function SessionsFilters({ range, status = '', q = '' }: Props) {
  return (
    <form action="/app/sessions" method="GET" className="flex flex-wrap items-center gap-3 border-b border-line p-4">
      <input type="hidden" name="range" value={range.preset} />
      {range.preset === 'custom' ? (
        <>
          <input type="hidden" name="from" value={range.from} />
          <input type="hidden" name="to" value={range.to} />
        </>
      ) : null}
      <div className="min-w-[200px] flex-1">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by employee name…"
          className="h-10 w-full rounded-input border border-line px-3 text-sm"
        />
      </div>
      <div>
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-input border border-line bg-surface px-3 text-sm text-ink-700"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="LEFT_RUNNING">Left running</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed by admin</option>
        </select>
      </div>
      <button type="submit" className="rounded-input bg-cta px-4 py-2 text-sm font-semibold text-white">
        Filter
      </button>
    </form>
  );
}
