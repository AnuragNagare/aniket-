import { z } from 'zod';

export const UPDATE_CATEGORIES = [
  'SITE_VISIT',
  'CLIENT_MEETING',
  'INSTALLATION',
  'SERVICE_REPAIR',
  'DELIVERY',
  'SALES_CALL',
  'OTHER',
] as const;
export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];

export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  SITE_VISIT: 'Site visit',
  CLIENT_MEETING: 'Client meeting',
  INSTALLATION: 'Installation',
  SERVICE_REPAIR: 'Service or repair',
  DELIVERY: 'Delivery',
  SALES_CALL: 'Sales call',
  OTHER: 'Other',
};

export const UPDATE_MIN = 5;
export const UPDATE_MAX = 2000;

export const UpdateTextSchema = z
  .string()
  .trim()
  .min(UPDATE_MIN, `Write at least ${UPDATE_MIN} characters.`)
  .max(UPDATE_MAX, 'Keep it under 2,000 characters.');

export const InputMethodSchema = z.enum(['TYPED', 'VOICE']);
export type InputMethod = z.infer<typeof InputMethodSchema>;

export const CreateUpdateSchema = z.object({
  /** Generated on the phone; sending the same id twice stores the update once. */
  clientUpdateId: z.string().uuid(),
  sessionId: z.string().uuid(),
  text: UpdateTextSchema,
  inputMethod: InputMethodSchema,
  category: z.enum(UPDATE_CATEGORIES).optional(),
  /** When the employee tapped Send (phone clock, corrected to server time). */
  submittedAt: z.string().datetime(),
});
export type CreateUpdateInput = z.output<typeof CreateUpdateSchema>;

export type SummaryStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export type WorkUpdateDto = {
  id: string;
  clientUpdateId: string;
  sessionId: string;
  text: string;
  inputMethod: InputMethod;
  category: UpdateCategory | null;
  submittedAt: string;
  summaryStatus: SummaryStatus;
};

export type CreateUpdateResponse = { update: WorkUpdateDto; duplicate: boolean };
