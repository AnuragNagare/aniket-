import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string; disabled?: boolean; title?: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
};

export function SegmentedTabs<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid grid-flow-col gap-1 rounded-input border border-line bg-surface p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          title={o.title}
          onClick={() => !o.disabled && onChange(o.value)}
          className={cn(
            'h-10 rounded-[9px] text-sm font-semibold transition',
            o.value === value ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900',
            o.disabled && 'cursor-not-allowed opacity-50 hover:text-ink-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
