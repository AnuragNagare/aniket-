'use server';

import { revalidatePath } from 'next/cache';
import type { DataExportDto } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function deactivateEmployee(employeeId: string) {
  const result = await serverMutate<{ ok: true; status: 'DISABLED' }>(
    `/employees/${encodeURIComponent(employeeId)}/deactivate`,
    {},
  );
  if (result.ok) {
    revalidatePath(`/app/employees/${employeeId}`, 'layout');
    revalidatePath('/app/employees', 'page');
  }
  return result;
}

export async function reactivateEmployee(employeeId: string) {
  const result = await serverMutate<{ ok: true; status: 'ACTIVE' }>(
    `/employees/${encodeURIComponent(employeeId)}/reactivate`,
    {},
  );
  if (result.ok) {
    revalidatePath(`/app/employees/${employeeId}`, 'layout');
    revalidatePath('/app/employees', 'page');
  }
  return result;
}

export async function sendPasswordReset(employeeId: string) {
  return serverMutate<{ ok: true }>(
    `/employees/${encodeURIComponent(employeeId)}/password-reset`,
    {},
  );
}

export async function requestExport(employeeId: string) {
  const result = await serverMutate<DataExportDto>(
    `/employees/${encodeURIComponent(employeeId)}/exports`,
    {},
  );
  if (result.ok) {
    revalidatePath(`/app/employees/${employeeId}`, 'layout');
  }
  return result;
}

export async function eraseEmployee(employeeId: string, confirmName: string) {
  const result = await serverMutate<{ ok: true; status: 'QUEUED' }>(
    `/employees/${encodeURIComponent(employeeId)}/erase`,
    { confirmName },
  );
  if (result.ok) {
    revalidatePath('/app/employees', 'page');
  }
  return result;
}
