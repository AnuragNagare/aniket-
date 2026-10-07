'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminSessionDto, EmployeeSessionsResponse } from '@worktrail/types';
import type { MutationResult } from '@/lib/mutation-result';
import { CloseSessionDialog } from './close-session-dialog';
import { HoursTable } from './hours-table';

type Props = {
  employeeId: string;
  data: EmployeeSessionsResponse;
  action: (employeeId: string, sessionId: string, endedAt: string) => Promise<MutationResult<AdminSessionDto>>;
};

export function HoursPanel({ employeeId, data, action }: Props) {
  const router = useRouter();
  const [closing, setClosing] = useState<AdminSessionDto | null>(null);
  return (
    <>
      <HoursTable data={data} onClose={setClosing} />
      {closing ? (
        <CloseSessionDialog
          employeeId={employeeId}
          session={closing}
          timezone={data.timezone}
          action={action}
          onDone={() => {
            setClosing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
