import { z } from 'zod';

export const ENV = Symbol('ENV');

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    QUEUE_DRIVER: z.enum(['bullmq', 'inline']).default('inline'),
    REDIS_URL: z.string().url().optional(),
    AI_ENABLED: z
      .preprocess((v) => (v === 'false' || v === false ? false : true), z.boolean())
      .default(true),
    GROQ_API_KEY: z.string().optional(),
    AI_UPDATE_MODEL: z.string().default('openai/gpt-oss-20b'),
    AI_REPORT_MODEL: z.string().default('openai/gpt-oss-120b'),
    REPORT_STORAGE_DIR: z.string().default('./storage/reports'),
    REPORT_TTL_DAYS: z.coerce.number().int().positive().default(30),
    TRUST_PROXY: z
      .preprocess((v) => (v === 'false' || v === false ? false : true), z.boolean())
      .default(true),
    SENTRY_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    ALLOW_LOCAL_STORAGE: z
      .preprocess((v) => (v === 'true' || v === true ? true : false), z.boolean())
      .default(false),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('Work Trail <no-reply@worktrail.in>'),
    EXPORT_TTL_DAYS: z.coerce.number().int().positive().default(7),
    RETENTION_RUN_HOUR_IST: z.coerce.number().int().min(0).max(23).default(2),
  })
  .superRefine((data, ctx) => {
    if (data.QUEUE_DRIVER === 'bullmq' && !data.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when QUEUE_DRIVER=bullmq',
      });
    }
    if (data.NODE_ENV === 'production' && data.AI_ENABLED && !data.GROQ_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GROQ_API_KEY'],
        message: 'GROQ_API_KEY is required in production when AI is enabled',
      });
    }
    if (data.NODE_ENV === 'production' && !data.SENTRY_DSN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SENTRY_DSN'],
        message: 'SENTRY_DSN is required in production',
      });
    }
    if (data.NODE_ENV === 'production' && data.STORAGE_DRIVER === 'local' && !data.ALLOW_LOCAL_STORAGE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'STORAGE_DRIVER=local is not permitted in production without ALLOW_LOCAL_STORAGE=true',
      });
    }
    if (data.STORAGE_DRIVER === 's3' && (!data.S3_BUCKET || !data.S3_ACCESS_KEY_ID || !data.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3',
      });
    }
  });
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
