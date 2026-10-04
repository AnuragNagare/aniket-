import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  icon?: LucideIcon;
  /** Fixed text before the value, e.g. "+91". */
  prefix?: string;
  trailing?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { icon: Icon, prefix, trailing, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        'flex h-12 items-center gap-2 rounded-input border bg-surface px-3 focus-within:ring-2 focus-within:ring-brand-500',
        rest['aria-invalid'] ? 'border-danger-500' : 'border-line',
      )}
    >
      {Icon ? <Icon className="size-[18px] shrink-0 text-ink-300" aria-hidden /> : null}
      {prefix ? (
        <span className="border-r border-line pr-2 text-sm font-medium text-ink-700">{prefix}</span>
      ) : null}
      <input
        ref={ref}
        {...rest}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-300',
          className,
        )}
      />
      {trailing}
    </div>
  );
});
