import { z } from 'zod';
import { EmailSchema } from './auth.js';
import { IndianMobileSchema } from './phone.js';

export type EmployeeStatus = 'WORKING' | 'OFF_DUTY';
/** INVITED = invite sent, no account yet. ACTIVE = the employee has set a password. */
export type EmployeeAccount = 'INVITED' | 'ACTIVE';

export type EmployeeListItem = {
  id: string;
  name: string;
  designation: string | null;
  employeeCode: string | null;
  email: string | null;
  status: EmployeeStatus;
  account: EmployeeAccount;
};

export type EmployeeListResponse = {
  items: EmployeeListItem[];
  page: number;
  pageSize: number;
  total: number;
};

/** Optional free text: trimmed, and blank becomes undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const InviteEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee's name.").max(160),
  email: EmailSchema,
  // Blank means "not given"; anything typed must be a valid Indian mobile.
  phone: z.preprocess((v) => (v === '' ? undefined : v), IndianMobileSchema.optional()),
  designation: optionalText(120),
  employeeCode: optionalText(80),
});
export type InviteEmployeeInput = z.output<typeof InviteEmployeeSchema>;
