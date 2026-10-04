import { z } from 'zod';
import { EmailSchema, PasswordSchema } from './auth.js';

export const ForgotPasswordSchema = z.object({ email: EmailSchema });
export type ForgotPasswordInput = z.output<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(20, 'This reset link is incomplete. Open the link from your email again.'),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.output<typeof ResetPasswordSchema>;
