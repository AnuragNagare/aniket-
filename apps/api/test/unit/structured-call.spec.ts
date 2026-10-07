import { describe, beforeEach, expect, it, vi } from 'vitest';
import { UpdateSummarySchema } from '@worktrail/types';
import { FakeAiClient } from '../../src/common/ai/fake.ai-client.js';
import { structuredCall } from '../../src/common/ai/structured-call.js';

const good = { summary: 'Installed one unit.', activities: ['Installation'], issues: [], followUps: [], confidence: 'HIGH' };
const req = { model: 'm', system: 'S', user: '{"employeeUpdate":"Installed one unit."}', schema: UpdateSummarySchema, maxTokens: 1000 };

describe('structuredCall', () => {
  const log = vi.fn();
  let ai: FakeAiClient;
  beforeEach(() => {
    ai = new FakeAiClient();
    log.mockReset();
  });

  it('returns valid output from one call and logs usage without text', async () => {
    ai.script({ kind: 'ok', data: good });
    await expect(structuredCall(ai, req, log)).resolves.toEqual({ ok: true, data: good, model: 'm' });
    expect(ai.calls).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'ok', attempt: 1, model: 'm', inputTokens: expect.any(Number) }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('Installed one unit');
  });

  it('repairs once when the output does not match the schema', async () => {
    ai.script({ kind: 'invalid', text: '```json\n{"summary":"x"}\n```' }, { kind: 'ok', data: good });
    await expect(structuredCall(ai, req, log)).resolves.toMatchObject({ ok: true });
    expect(ai.calls).toHaveLength(2);
    expect(ai.calls[1]!.user).toContain('did not match the required JSON schema');
    expect(ai.calls[1]!.user).toContain('{"summary":"x"}');
  });

  it('fails after one repair', async () => {
    ai.script({ kind: 'invalid', text: 'nope' }, { kind: 'invalid', text: 'still nope' });
    await expect(structuredCall(ai, req, log)).resolves.toEqual({ ok: false, reason: 'INVALID_OUTPUT' });
    expect(ai.calls).toHaveLength(2);
  });

  it('treats truncated output as invalid and repairs', async () => {
    ai.script({ kind: 'truncated', text: '{"summary":"Inst' }, { kind: 'ok', data: good });
    await expect(structuredCall(ai, req, log)).resolves.toMatchObject({ ok: true });
  });

  it('does not retry a refusal', async () => {
    ai.script({ kind: 'refused' });
    await expect(structuredCall(ai, req, log)).resolves.toEqual({ ok: false, reason: 'REFUSED' });
    expect(ai.calls).toHaveLength(1);
  });
});
