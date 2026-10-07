'use server';

import { revalidatePath } from 'next/cache';
import type { AdminSessionDto } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function closeSession(employeeId: string, sessionId: string, endedAt: string) {
  const result = await serverMutate<AdminSessionDto>(
    `/employees/${encodeURIComponent(employeeId)}/sessions/${encodeURIComponent(sessionId)}/close`,
    { endedAt },
  );
  if (result.ok) revalidatePath(`/app/employees/${employeeId}`, 'layout');
  return result;
}
