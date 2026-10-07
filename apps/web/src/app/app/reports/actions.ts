'use server';

import { revalidatePath } from 'next/cache';
import type { ReportDto } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function createCompanyReport(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean } | null> {
  const employeeId = formData.get('employeeId')?.toString() || '';
  const from = formData.get('from')?.toString() || '';
  const to = formData.get('to')?.toString() || '';

  if (!employeeId) {
    return { error: 'Please select an employee.' };
  }
  if (!from || !to) {
    return { error: 'Please choose valid dates.' };
  }

  const result = await serverMutate<{ report: ReportDto }>('/reports', {
    employeeId,
    from,
    to,
  });

  if (!result.ok) {
    return { error: result.message || 'Failed to create report.' };
  }

  revalidatePath('/app/reports');
  return { success: true };
}
