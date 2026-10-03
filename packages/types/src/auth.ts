import { z } from 'zod';
import { IndianMobileSchema } from './phone.js';

export const RoleSchema = z.enum(['OWNER', 'ADMIN', 'EMPLOYEE']);
export type Role = z.infer<typeof RoleSchema>;

const Email = z.string().trim().toLowerCase().email('Enter a valid email address.');
export const PasswordSchema = z.string().min(8, 'Use at least 8 characters.').max(128);

export const AdminSignupSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name.').max(160),
  name: z.string().trim().min(2, 'Enter your name.').max(160),
  email: Email,
  phone: IndianMobileSchema,
  password: PasswordSchema,
});
export type AdminSignupInput = z.output<typeof AdminSignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.output<typeof LoginSchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(20) });
export type RefreshInput = z.output<typeof RefreshSchema>;

export type AuthUser = { id: string; role: Role; companyId: string; name: string; email: string };
export type AuthTokens = { accessToken: string; refreshToken: string; user: AuthUser };
