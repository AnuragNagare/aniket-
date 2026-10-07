import type { EmployeeDetail, MeResponse } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { Suspense } from 'react';
import { EmployeeHeader } from '@/components/employee-detail/employee-header';
import { TabNav } from '@/components/employee-detail/tab-nav';
import { serverApi } from '@/lib/server-api';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function EmployeeLayout({ children, params }: Props) {
  const { id } = await params;
  const [employee, me] = await Promise.all([
    serverApi<EmployeeDetail>(`/employees/${id}`),
    serverApi<MeResponse>('/me'),
  ]);
  const tz = me.company.timezone;
  return (
    <div className="mx-auto max-w-[1280px] space-y-6" data-today={formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')}>
      <EmployeeHeader employee={employee} timezone={tz} />
      <Suspense>
        <TabNav id={id} />
      </Suspense>
      {children}
    </div>
  );
}
