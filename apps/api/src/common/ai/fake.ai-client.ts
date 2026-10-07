import { PeriodReportSchema, UpdateSummarySchema } from '@worktrail/types';
import type { AiClient, AiRaw, AiRequest } from './ai-client.js';

export type ScriptedResponse =
  | { kind: 'ok'; data: unknown }
  | { kind: 'invalid'; text: string }
  | { kind: 'truncated'; text: string }
  | { kind: 'refused' }
  | { kind: 'disabled' };

export class FakeAiClient implements AiClient {
  private queue: ScriptedResponse[] = [];
  calls: Array<{ model: string; system: string; user: string }> = [];

  script(...responses: ScriptedResponse[]) {
    this.queue.push(...responses);
  }

  reset() {
    this.queue = [];
    this.calls = [];
  }

  async complete<T>(req: AiRequest<T>): Promise<AiRaw<T>> {
    this.calls.push({ model: req.model, system: req.system, user: req.user });
    const usage = { inputTokens: 10, outputTokens: 10, latencyMs: 1 };
    const next = this.queue.shift();
    if (next) {
      if (next.kind === 'disabled') return { kind: 'disabled' };
      if (next.kind === 'refused') return { kind: 'refused', usage };
      if (next.kind === 'invalid') return { kind: 'invalid', text: next.text, usage };
      if (next.kind === 'truncated') return { kind: 'truncated', text: next.text, usage };
      return { kind: 'ok', data: next.data as T, usage };
    }

    // Default valid mock based on candidate schema
    let parsedInput: { employeeUpdate?: string } = {};
    try {
      parsedInput = JSON.parse(req.user);
    } catch {
      // ignore
    }

    const defaultUpdate = {
      summary: (parsedInput.employeeUpdate ?? 'Default update summary.').slice(0, 60),
      activities: ['Field work'],
      issues: [],
      followUps: [],
      confidence: 'HIGH' as const,
    };
    if (UpdateSummarySchema.safeParse(defaultUpdate).success && req.schema.safeParse(defaultUpdate).success) {
      return { kind: 'ok', data: defaultUpdate as T, usage };
    }

    const defaultPeriod = {
      overview: 'Fake overview for the period.',
      keyActivities: ['Field visits'],
      reportedIssues: [],
      reportedFollowUps: [],
      dataNotes: [],
    };
    if (PeriodReportSchema.safeParse(defaultPeriod).success && req.schema.safeParse(defaultPeriod).success) {
      return { kind: 'ok', data: defaultPeriod as T, usage };
    }

    return { kind: 'invalid', text: '{}', usage };
  }
}
