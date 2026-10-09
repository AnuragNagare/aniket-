'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminSessionDto, WorkSessionRow, WorkSessionsResponse } from '@worktrail/types';
import type { MutationResult } from '@/lib/mutation-result';
import { CloseSessionDialog } from '@/components/employee-detail/close-session-dialog';
import { SessionsTable } from './sessions-table';

type Props = {
  data: WorkSessionsResponse;
  action: (employeeId: string, sessionId: string, endedAt: string) => Promise<MutationResult<AdminSessionDto>>;
};

/** The company-wide sessions table, with the same audited "Close session" flow as the employee page. */
export function SessionsPanel({ data, action }: Props) {
  const router = useRouter();
  const [closing, setClosing] = useState<WorkSessionRow | null>(null);
  return (
    <>
      <SessionsTable data={data} onClose={setClosing} />
      {closing ? (
        <CloseSessionDialog
          employeeId={closing.employeeId}
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
