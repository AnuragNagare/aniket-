'use server';

import { revalidatePath } from 'next/cache';
import type { PeriodSummaryDto, ReportDto } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function createSummary(
  employeeId: string,
  from: string,
  to: string,
  refresh = false,
): Promise<{ ok: boolean }> {
  const path = `/employees/${encodeURIComponent(employeeId)}/summaries${refresh ? '?refresh=1' : ''}`;
  const result = await serverMutate<PeriodSummaryDto>(path, { from, to });
  if (result.ok) {
    revalidatePath(`/app/employees/${employeeId}/reports`);
  }
  return { ok: result.ok };
}

export async function createReport(
  employeeId: string,
  from: string,
  to: string,
): Promise<void> {
  const result = await serverMutate<{ report: ReportDto }>('/reports', {
    employeeId,
    from,
    to,
  });
  if (result.ok) {
    revalidatePath(`/app/employees/${employeeId}/reports`);
  }
}
