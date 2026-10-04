import type { EmployeeListItem } from '@worktrail/types';
import { cn } from '@/lib/cn';

const STYLES = {
  WORKING: { label: 'Working', className: 'bg-success-50 text-success-500', dot: 'bg-success-500' },
  OFF_DUTY: { label: 'Off duty', className: 'bg-canvas text-ink-500', dot: 'bg-ink-300' },
  INVITED: { label: 'Invite pending', className: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
} as const;

/** One status per person: a pending invite wins over working/off duty. */
export function StatusChip({ employee }: { employee: Pick<EmployeeListItem, 'status' | 'account'> }) {
  const s = STYLES[employee.account === 'INVITED' ? 'INVITED' : employee.status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        s.className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
