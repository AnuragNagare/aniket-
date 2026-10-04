import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  trailingArrow?: boolean;
  loading?: boolean;
};

const variants = {
  primary: 'bg-cta text-white shadow-[0_8px_20px_rgba(254,90,12,.28)] hover:brightness-95',
  secondary: 'border border-brand-200 bg-surface text-brand-700 hover:bg-brand-50',
  ghost: 'text-brand-700 hover:bg-brand-50',
};

export function Button({
  variant = 'primary',
  trailingArrow,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-input px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      <span>{children}</span>
      {trailingArrow && !loading ? <ArrowRight className="size-5" aria-hidden /> : null}
    </button>
  );
}
