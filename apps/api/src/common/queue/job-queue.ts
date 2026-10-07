export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const QUEUE_NAME = 'worktrail';

export type JobData = {
  'update.summarise': { updateId: string };
  'period.summarise': { summaryId: string };
  'report.generate': { reportId: string };
  'maintenance.sweep': Record<string, never>;
};
export type JobName = keyof JobData;

export interface JobQueue {
  add<N extends JobName>(name: N, data: JobData[N], opts?: { jobId?: string; delayMs?: number }): Promise<void>;
}
