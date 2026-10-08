import { z } from 'zod';

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const UpdateCompanySchema = z
  .object({
    name: z.string().trim().min(1, 'Company name is required.').max(160).optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidTimezone, 'Invalid IANA timezone.')
      .optional(),
    preciseLocationRetentionDays: z
      .number()
      .int()
      .min(30, 'Choose between 30 and 365 days.')
      .max(365, 'Choose between 30 and 365 days.')
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.timezone !== undefined ||
      data.preciseLocationRetentionDays !== undefined,
    'Provide at least one field to update.',
  );
export type UpdateCompanyInput = z.output<typeof UpdateCompanySchema>;

export type CompanyDto = {
  id: string;
  name: string;
  timezone: string;
  preciseLocationRetentionDays: number;
  createdAt: string;
  updatedAt: string;
};

export const UpdateAccountSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(160).optional(),
    phone: z.string().trim().max(24).nullable().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.phone !== undefined,
    'Provide at least one field to update.',
  );
export type UpdateAccountInput = z.output<typeof UpdateAccountSchema>;

export const ChangePasswordSchema = z.object({
  current: z.string().min(1, 'Current password is required.'),
  next: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(100),
});
export type ChangePasswordInput = z.output<typeof ChangePasswordSchema>;

export type AccountDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

