import { Global, Logger, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { AI_CLIENT, type AiClient } from './ai-client.js';
import { AnthropicAiClient } from './anthropic.ai-client.js';
import { FakeAiClient } from './fake.ai-client.js';
import type { AiLog } from './structured-call.js';

export const AI_LOG = Symbol('AI_LOG');
export const fakeAiClientInstance = new FakeAiClient();

@Global()
@Module({
  providers: [
    {
      provide: AI_CLIENT,
      useFactory: (env: Env): AiClient => {
        if (!env.AI_ENABLED) {
          return {
            async complete() {
              return { kind: 'disabled' };
            },
          };
        }
        if (env.NODE_ENV === 'test') {
          return fakeAiClientInstance;
        }
        return new AnthropicAiClient(env.ANTHROPIC_API_KEY ?? '');
      },
      inject: [ENV],
    },
    {
      provide: AI_LOG,
      useFactory: (): AiLog => {
        const logger = new Logger('ai');
        return (entry) => logger.log(JSON.stringify(entry));
      },
    },
  ],
  exports: [AI_CLIENT, AI_LOG],
})
export class AiModule {}
