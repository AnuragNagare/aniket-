import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiClient, AiRaw, AiRequest } from './ai-client.js';

export class AnthropicAiClient implements AiClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    // The SDK retries 408/409/429/5xx and connection errors twice; BullMQ retries the job after that.
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  async complete<T>(req: AiRequest<T>): Promise<AiRaw<T>> {
    const started = Date.now();
    const res = await this.client.messages.parse({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      output_config: { effort: 'low', format: zodOutputFormat(req.schema as never) },
    });
    const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, latencyMs: Date.now() - started };
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');

    if (res.stop_reason === 'refusal') return { kind: 'refused', usage };
    if (res.stop_reason === 'max_tokens') return { kind: 'truncated', text, usage };
    if (res.parsed_output == null) return { kind: 'invalid', text, usage };
    return { kind: 'ok', data: res.parsed_output as T, usage };
  }
}
