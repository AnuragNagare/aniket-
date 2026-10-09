import { z } from 'zod';
import { TransientAiError } from './ai-errors.js';
import type { AiClient, AiRaw, AiRequest } from './ai-client.js';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 60_000;
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

type ChatResponse = {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Groq's OpenAI-compatible chat API (gpt-oss models support strict JSON-schema output). Output is requested as JSON-schema and then validated by our own Zod schema. */
export class GroqAiClient implements AiClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async complete<T>(req: AiRequest<T>): Promise<AiRaw<T>> {
    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens,
          reasoning_effort: 'low',
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'result', strict: true, schema: z.toJSONSchema(req.schema as z.ZodType) },
          },
        }),
      });
    } catch (e) {
      // Timeouts and dropped connections are retryable; anything else is a bug and should surface.
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError' || e instanceof TypeError)) {
        throw new TransientAiError(`Groq request failed: ${e.message}`);
      }
      throw e;
    }

    if (!res.ok) {
      if (TRANSIENT_STATUS.has(res.status)) throw new TransientAiError(`Groq returned HTTP ${res.status}`);
      throw new Error(`Groq returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as ChatResponse;
    const usage = {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
    const choice = body.choices?.[0];
    const text = choice?.message?.content ?? '';

    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') return { kind: 'refused', usage };
    if (choice?.finish_reason === 'length') return { kind: 'truncated', text, usage };

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { kind: 'invalid', text, usage };
    }
    const parsed = req.schema.safeParse(json);
    return parsed.success ? { kind: 'ok', data: parsed.data, usage } : { kind: 'invalid', text, usage };
  }
}
