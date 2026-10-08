export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const QUEUE_NAME = 'worktrail';

export type JobData = {
  'update.summarise': { updateId: string };
  'period.summarise': { summaryId: string };
  'report.generate': { reportId: string };
  'maintenance.sweep': Record<string, never>;
  'maintenance.retention': Record<string, never>;
  'privacy.export': { exportId: string; companyId: string; employeeId: string };
  'privacy.erase': { employeeId: string; companyId: string };
};
export type JobName = keyof JobData;

export interface JobQueue {
  add<N extends JobName>(name: N, data: JobData[N], opts?: { jobId?: string; delayMs?: number }): Promise<void>;
}
