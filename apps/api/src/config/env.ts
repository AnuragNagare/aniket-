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
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_UPDATE_MODEL: z.string().default('claude-opus-5-5'),
    AI_REPORT_MODEL: z.string().default('claude-opus-5-5'),
    REPORT_STORAGE_DIR: z.string().default('./storage/reports'),
    REPORT_TTL_DAYS: z.coerce.number().int().positive().default(30),
  })
  .superRefine((data, ctx) => {
    if (data.QUEUE_DRIVER === 'bullmq' && !data.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when QUEUE_DRIVER=bullmq',
      });
    }
    if (data.NODE_ENV === 'production' && data.AI_ENABLED && !data.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ANTHROPIC_API_KEY'],
        message: 'ANTHROPIC_API_KEY is required in production when AI is enabled',
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
