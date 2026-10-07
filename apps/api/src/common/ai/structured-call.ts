import type { AiClient, AiRequest } from './ai-client.js';

export type AiLog = (entry: Record<string, unknown>) => void;
export type StructuredResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; reason: 'INVALID_OUTPUT' | 'REFUSED' | 'AI_DISABLED' };

const repairPrompt = (original: string, badOutput: string) =>
  [
    'Your previous reply did not match the required JSON schema.',
    'Return only the corrected JSON object for the same input. Do not add any facts.',
    `Previous reply:\n${badOutput.slice(0, 4000)}`,
    `Original input:\n${original}`,
  ].join('\n\n');

/** ai-prompts.pdf → Failure handling: validate, retry once with a repair prompt, then give up. */
export async function structuredCall<T>(
  ai: AiClient,
  req: AiRequest<T>,
  log: AiLog,
): Promise<StructuredResult<T>> {
  let user = req.user;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await ai.complete({ ...req, user });
    if (r.kind === 'disabled') return { ok: false, reason: 'AI_DISABLED' };
    log({ model: req.model, attempt, outcome: r.kind, ...r.usage });
    if (r.kind === 'ok') return { ok: true, data: r.data, model: req.model };
    if (r.kind === 'refused') return { ok: false, reason: 'REFUSED' };
    user = repairPrompt(req.user, r.text);
  }
  return { ok: false, reason: 'INVALID_OUTPUT' };
}
