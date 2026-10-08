import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { EmployeeDetail } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';
import { StatusChip } from '@/components/employees/status-chip';
import { ConsentLine } from './consent-line';
import { EmployeeActionsMenu } from './employee-actions-menu';
import { timeIn } from '@/lib/format';

export function EmployeeHeader({ employee, timezone }: { employee: EmployeeDetail; timezone: string }) {
  const presence = employee.workingSince
    ? `Working since ${timeIn(employee.workingSince, timezone)}`
    : employee.lastSeenAt
      ? `Off duty · last seen ${timeIn(employee.lastSeenAt, timezone)}`
      : null;
  return (
    <div className="space-y-4">
      <Link href="/app/employees" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Employees
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={employee.name} size={56} />
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight">{employee.name}</h1>
          <p className="text-ink-500">{[employee.designation, employee.employeeCode, employee.email, employee.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <StatusChip employee={employee} />
            <EmployeeActionsMenu employee={employee} />
          </div>
          {presence ? <span className="text-sm text-ink-500">{presence}</span> : null}
          <ConsentLine consentedAt={employee.consentedAt} timezone={timezone} />
        </div>
      </div>
    </div>
  );
}
