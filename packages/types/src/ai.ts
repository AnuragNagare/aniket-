import { z } from 'zod';

export const AI_LABEL = 'AI-generated summary based on submitted work updates and recorded work-session data.';
export const NOT_ENOUGH_INFO = 'Not enough information provided.';

const list = z.array(z.string().trim().min(1).max(200)).max(12);

/** ai-prompts.pdf → "Per-update summary" → Required JSON schema. */
export const UpdateSummarySchema = z.strictObject({
  summary: z.string().trim().min(1).max(280),
  activities: list,
  issues: list,
  followUps: list,
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});
export type UpdateSummary = z.output<typeof UpdateSummarySchema>;

/** ai-prompts.pdf → "Period report" → Required JSON schema. */
export const PeriodReportSchema = z.strictObject({
  overview: z.string().trim().min(1).max(600),
  keyActivities: list,
  reportedIssues: list,
  reportedFollowUps: list,
  dataNotes: list,
});
export type PeriodReport = z.output<typeof PeriodReportSchema>;

export const CONFIDENCE_LABELS = { HIGH: 'Clear update', MEDIUM: 'Partly clear', LOW: 'Unclear update' } as const;
