import { z } from 'zod';

export const PRIVACY_NOTICE_VERSION = '2026-10-v1';

export type PrivacySection = {
  heading: string;
  body: string;
};

export type PrivacyNotice = {
  version: string;
  title: string;
  sections: PrivacySection[];
  retentionDays: number;
};

export const ConsentSchema = z.object({
  version: z.string().min(1).max(32),
  appVersion: z.string().max(32).optional(),
  deviceModel: z.string().max(80).optional(),
});
export type ConsentInput = z.output<typeof ConsentSchema>;

export type ConsentDto = {
  version: string;
  acceptedAt: string;
};

export const DeletionRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type DeletionRequestInput = z.output<typeof DeletionRequestSchema>;

export type DeletionRequestDto = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  reason: string | null;
  status: 'OPEN' | 'DONE' | 'DISMISSED';
  resolvedBy: string | null;
  resolvedAt: string | null;
  note: string | null;
  createdAt: string;
};

export type DataExportDto = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  status: 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';
  byteSize: number | null;
  createdAt: string;
  generatedAt: string | null;
  expiresAt: string | null;
};

export const DismissDeletionRequestSchema = z.object({
  note: z.string().trim().min(1, 'Note is required.').max(500),
});
export type DismissDeletionRequestInput = z.output<typeof DismissDeletionRequestSchema>;

export const EraseEmployeeSchema = z.object({
  confirmName: z.string().trim().min(1, "Type the employee's name exactly to confirm."),
});
export type EraseEmployeeInput = z.output<typeof EraseEmployeeSchema>;

