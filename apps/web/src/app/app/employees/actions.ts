'use server';

import { revalidatePath } from 'next/cache';
import type { InvitationCreated, InviteEmployeeInput } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function inviteEmployee(values: InviteEmployeeInput) {
  const result = await serverMutate<InvitationCreated>('/employees/invitations', values);
  if (result.ok) revalidatePath('/app/employees');
  return result;
}

export async function resendInvite(employeeId: string) {
  return serverMutate<InvitationCreated>(
    `/employees/${encodeURIComponent(employeeId)}/invitations`,
  );
}
