import { cn } from '@/lib/cn';

/** Pin-and-trail mark with the "Work Trail" wordmark ("Trail" in brand orange). */
export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span role="img" aria-label="Work Trail" className={cn('inline-flex items-center gap-1.5', className)}>
      <svg aria-hidden viewBox="0 0 24 32" className={size === 'sm' ? 'h-6' : 'h-8'}>
        <path
          d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z"
          fill="#FE5A0C"
        />
        <circle cx="12" cy="11" r="4" fill="#fff" />
        <path
          d="M4 30c4-3 12 1 16-2"
          stroke="#FE5A0C"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden
        className={cn(
          'font-display font-bold tracking-tight',
          size === 'sm' ? 'text-xl' : 'text-[26px]',
        )}
      >
        <span className="text-ink-900">Work</span> <span className="text-brand-500">Trail</span>
      </span>
    </span>
  );
}
