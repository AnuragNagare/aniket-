import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import type { EmployeeListResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { EmployeeTable } from '@/components/employees/employee-table';
import { EmployeesToolbar } from '@/components/employees/employees-toolbar';
import { Pagination } from '@/components/employees/pagination';
import { parseEmployeesQuery, toApiSearch } from '@/lib/employees-query';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Employees · Work Trail' };

export default async function EmployeesPage({ searchParams }: PageProps<'/app/employees'>) {
  const query = parseEmployeesQuery(await searchParams);
  const data = await serverApi<EmployeeListResponse>(`/employees${toApiSearch(query)}`);
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight">Employees</h1>
          <p className="mt-1 text-ink-500">Everyone on your team, and who is working right now.</p>
        </div>
        <Link
          href="/app/employees/new"
          className="inline-flex h-11 items-center gap-2 rounded-input bg-cta px-5 text-sm font-semibold text-white"
        >
          <UserPlus className="size-[18px]" aria-hidden />
          Invite employee
        </Link>
      </div>
      <Card className="overflow-hidden">
        <EmployeesToolbar query={query} />
        <EmployeeTable
          items={data.items}
          filtered={query.query !== '' || query.status !== 'ALL'}
        />
        <Pagination query={query} pageSize={data.pageSize} total={data.total} />
      </Card>
    </div>
  );
}
