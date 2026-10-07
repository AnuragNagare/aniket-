export default function EmployeeLoading() {
  const block = 'animate-pulse rounded-card bg-surface shadow-card';
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading employee details">
      <div className="h-10 w-96 animate-pulse rounded-input bg-brand-50" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-36`} />
        ))}
      </div>
      <div className={`${block} h-[320px]`} />
    </div>
  );
}
