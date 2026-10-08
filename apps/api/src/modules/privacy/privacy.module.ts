import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { ConsentService } from './services/consent.service.js';
import { RetentionService } from './services/retention.service.js';
import { PrivacyController } from './controllers/privacy.controller.js';
import { MePrivacyController } from './controllers/me-privacy.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PrivacyController, MePrivacyController],
  providers: [ConsentService, RetentionService],
  exports: [ConsentService, RetentionService],
})
export class PrivacyModule {}
