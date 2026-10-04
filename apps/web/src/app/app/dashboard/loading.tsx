/** Skeleton shown while the dashboard data loads. */
export default function DashboardLoading() {
  const block = 'animate-pulse rounded-card bg-surface shadow-card';
  return (
    <div className="mx-auto max-w-[1280px] space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-16 w-80 animate-pulse rounded-input bg-brand-50" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-40`} />
        ))}
      </div>
      <div className={`${block} h-[380px]`} />
    </div>
  );
}
