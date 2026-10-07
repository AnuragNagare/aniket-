import { Inject, Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { UpdateSummarySchema } from '@worktrail/types';
import { AI_CLIENT, type AiClient } from '../../../common/ai/ai-client.js';
import { structuredCall } from '../../../common/ai/structured-call.js';
import { RetryableJobError } from '../../../common/queue/job-errors.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { UPDATE_SYSTEM_PROMPT, updatePayload } from '../prompts.js';

const TRANSIENT = [Anthropic.RateLimitError, Anthropic.InternalServerError, Anthropic.APIConnectionError];

@Injectable()
export class UpdateSummaryService {
  private readonly log = new Logger('ai');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async process(updateId: string, opts: { finalAttempt?: boolean } = {}): Promise<void> {
    // Claim it. A second runner (duplicate job, sweeper) finds nothing to claim and stops.
    const claimed = await this.prisma.workUpdate.updateMany({
      where: { id: updateId, summaryStatus: { in: ['QUEUED', 'PROCESSING'] } },
      data: { summaryStatus: 'PROCESSING' },
    });
    if (claimed.count === 0) return;
    const u = await this.prisma.workUpdate.findUniqueOrThrow({ where: { id: updateId }, select: { text: true, category: true } });

    try {
      const r = await structuredCall(
        this.ai,
        { model: this.env.AI_UPDATE_MODEL, system: UPDATE_SYSTEM_PROMPT, user: updatePayload(u), schema: UpdateSummarySchema, maxTokens: 2000 },
        (e) => this.log.log(JSON.stringify({ job: 'update.summarise', sourceIds: [updateId], ...e })),
      );
      await this.prisma.workUpdate.update({
        where: { id: updateId },
        data: r.ok
          ? { summaryStatus: 'COMPLETE', aiSummary: r.data.summary, aiStructuredData: r.data as any, modelName: r.model, summaryError: null, summaryGeneratedAt: new Date() }
          : { summaryStatus: 'FAILED', summaryError: r.reason },
      });
    } catch (e) {
      if (TRANSIENT.some((T) => e instanceof T)) {
        if (opts.finalAttempt) {
          await this.prisma.workUpdate.update({ where: { id: updateId }, data: { summaryStatus: 'FAILED', summaryError: 'AI_UNAVAILABLE' } });
          return;
        }
        throw new RetryableJobError('AI temporarily unavailable');
      }
      await this.prisma.workUpdate.update({ where: { id: updateId }, data: { summaryStatus: 'FAILED', summaryError: 'UNEXPECTED' } });
      throw e;
    }
  }
}
