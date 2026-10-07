import { Module } from '@nestjs/common';
import { AuditModule } from './common/audit/audit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { QueueModule } from './common/queue/queue.module.js';
import { AiModule } from './common/ai/ai.module.js';
import { SummariesModule } from './modules/summaries/summaries.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    QueueModule,
    AiModule,
    SummariesModule,
  ],
})
export class WorkerModule {}
