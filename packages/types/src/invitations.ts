import { z } from 'zod';
import { PasswordSchema } from './auth.js';

export type InvitationCreated = {
  employeeId: string;
  inviteUrl: string;
  expiresAt: string;
  emailSent: boolean;
};

export type InvitationPreview = {
  companyName: string;
  employeeName: string;
  email: string;
  expiresAt: string;
};

export const AcceptInvitationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(160),
  password: PasswordSchema,
});
export type AcceptInvitationInput = z.output<typeof AcceptInvitationSchema>;
