'use server';

import { revalidatePath } from 'next/cache';
import type {
  AccountDto,
  ChangePasswordInput,
  CompanyDto,
  UpdateAccountInput,
  UpdateCompanyInput,
} from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function updateCompanyAction(values: UpdateCompanyInput) {
  const result = await serverMutate<CompanyDto>('/company', values, 'PATCH');
  if (result.ok) {
    revalidatePath('/app/settings');
    revalidatePath('/app/settings/privacy');
  }
  return result;
}

export async function updateAccountAction(values: UpdateAccountInput) {
  const result = await serverMutate<AccountDto>('/me/account', values, 'PATCH');
  if (result.ok) {
    revalidatePath('/app/settings/account');
  }
  return result;
}

export async function changePasswordAction(values: ChangePasswordInput) {
  return serverMutate<{ ok: boolean }>('/me/password', values, 'POST');
}
