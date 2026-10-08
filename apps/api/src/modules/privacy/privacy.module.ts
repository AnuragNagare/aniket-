import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { QueueModule } from '../../common/queue/queue.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConsentService } from './services/consent.service.js';
import { RetentionService } from './services/retention.service.js';
import { DeletionRequestsService } from './services/deletion-requests.service.js';
import { ExportsService } from './services/exports.service.js';
import { ErasureService } from './services/erasure.service.js';
import { PrivacyController } from './controllers/privacy.controller.js';
import { MePrivacyController } from './controllers/me-privacy.controller.js';
import { DeletionRequestsController } from './controllers/deletion-requests.controller.js';
import { ExportsController } from './controllers/exports.controller.js';
import { EraseController } from './controllers/erase.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, StorageModule, QueueModule, AuthModule],
  controllers: [
    PrivacyController,
    MePrivacyController,
    DeletionRequestsController,
    ExportsController,
    EraseController,
  ],
  providers: [
    ConsentService,
    RetentionService,
    DeletionRequestsService,
    ExportsService,
    ErasureService,
  ],
  exports: [
    ConsentService,
    RetentionService,
    DeletionRequestsService,
    ExportsService,
    ErasureService,
  ],
})
export class PrivacyModule {}

