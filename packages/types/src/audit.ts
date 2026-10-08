import { z } from 'zod';

export const AuditActionSchema = z.enum([
  'invitation.created',
  'invitation.resent',
  'invitation.accepted',
  'password.reset',
  'password.changed',
  'account.updated',
  'session.closed_by_admin',
  'summary.requested',
  'report.requested',
  'report.downloaded',
  'admin.signed_in',
  'company.updated',
  'retention.updated',
  'retention.purged',
  'consent.recorded',
  'deletion.requested',
  'deletion.dismissed',
  'employee.deactivated',
  'employee.reactivated',
  'employee.password_reset_sent',
  'employee.erased',
  'export.requested',
  'export.downloaded',
  'company.erased',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'invitation.created': 'Created an employee invitation',
  'invitation.resent': 'Resent an employee invitation',
  'invitation.accepted': 'Accepted an invitation',
  'password.reset': 'Reset password via email link',
  'password.changed': 'Changed account password',
  'account.updated': 'Updated account profile',
  'session.closed_by_admin': 'Closed an active work session',
  'summary.requested': 'Requested daily summary',
  'report.requested': 'Requested a PDF report',
  'report.downloaded': 'Downloaded a PDF report',
  'admin.signed_in': 'Signed in to web dashboard',
  'company.updated': 'Updated company settings',
  'retention.updated': 'Updated data retention period',
  'retention.purged': 'Purged expired precise locations',
  'consent.recorded': 'Recorded privacy notice consent',
  'deletion.requested': 'Submitted a data deletion request',
  'deletion.dismissed': 'Dismissed a data deletion request',
  'employee.deactivated': 'Deactivated an employee account',
  'employee.reactivated': 'Reactivated an employee account',
  'employee.password_reset_sent': 'Sent employee password reset email',
  'employee.erased': 'Permanently erased employee data',
  'export.requested': 'Requested employee data export',
  'export.downloaded': 'Downloaded employee data export',
  'company.erased': 'Erased company account',
};

export const AuditLogQuerySchema = z.object({
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export type AuditLogItem = {
  id: string;
  action: AuditAction;
  label: string;
  actorName: string | null;
  entityType: string;
  entityName: string | null;
  createdAt: string;
  ip: string | null;
  details: Record<string, string | number>;
};

export type AuditLogsResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
