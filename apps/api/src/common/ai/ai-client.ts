import type { z } from 'zod';

export const AI_CLIENT = Symbol('AI_CLIENT');

export type AiUsage = { inputTokens: number; outputTokens: number; latencyMs: number };
export type AiRequest<T> = { model: string; system: string; user: string; schema: z.ZodType<T>; maxTokens: number };
export type AiRaw<T> =
  | { kind: 'ok'; data: T; usage: AiUsage }
  | { kind: 'invalid'; text: string; usage: AiUsage }
  | { kind: 'truncated'; text: string; usage: AiUsage }
  | { kind: 'refused'; usage: AiUsage }
  | { kind: 'disabled' };

export interface AiClient {
  complete<T>(req: AiRequest<T>): Promise<AiRaw<T>>;
}
