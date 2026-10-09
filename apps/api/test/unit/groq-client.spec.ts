import { z } from 'zod';
import { TransientAiError } from '../../src/common/ai/ai-errors.js';
import { GroqAiClient } from '../../src/common/ai/groq.ai-client.js';

const schema = z.object({ summary: z.string() });
const req = { model: 'openai/gpt-oss-120b', system: 'sys', user: '{"a":1}', schema, maxTokens: 100 };
const reply = (choice: object, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => ({ choices: [choice], usage: { prompt_tokens: 5, completion_tokens: 7 } }),
  });
const client = (f: ReturnType<typeof vi.fn>) => new GroqAiClient('key_1', f as never);

describe('GroqAiClient', () => {
  it('sends a JSON-schema request with the bearer key and returns validated data', async () => {
    const f = reply({ finish_reason: 'stop', message: { content: '{"summary":"ok"}' } });
    const r = await client(f).complete(req);
    expect(r).toMatchObject({ kind: 'ok', data: { summary: 'ok' }, usage: { inputTokens: 5, outputTokens: 7 } });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer key_1');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
  });

  it('reports non-JSON and schema-breaking output as invalid, keeping the text for the repair prompt', async () => {
    expect(await client(reply({ finish_reason: 'stop', message: { content: 'nope' } })).complete(req)).toMatchObject({ kind: 'invalid', text: 'nope' });
    expect(await client(reply({ finish_reason: 'stop', message: { content: '{"x":1}' } })).complete(req)).toMatchObject({ kind: 'invalid' });
  });

  it('maps length and content_filter finishes to truncated and refused', async () => {
    expect(await client(reply({ finish_reason: 'length', message: { content: '{"su' } })).complete(req)).toMatchObject({ kind: 'truncated' });
    expect((await client(reply({ finish_reason: 'content_filter', message: { content: '' } })).complete(req)).kind).toBe('refused');
  });

  it.each([429, 500, 503])('throws a retryable error for HTTP %i', async (status) => {
    await expect(client(reply({}, status)).complete(req)).rejects.toBeInstanceOf(TransientAiError);
  });

  it('throws a plain error for a client mistake such as a bad key', async () => {
    const err = await client(reply({}, 401)).complete(req).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TransientAiError);
  });

  it('treats a dropped connection as retryable', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(client(f).complete(req)).rejects.toBeInstanceOf(TransientAiError);
  });
});
