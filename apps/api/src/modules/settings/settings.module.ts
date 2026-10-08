import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { CompanyController } from './controllers/company.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { AuditLogsController } from './controllers/audit-logs.controller.js';
import { CompanySettingsService } from './services/company-settings.service.js';
import { AccountSettingsService } from './services/account-settings.service.js';
import { AuditLogService } from './services/audit-log.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CompanyController, AccountController, AuditLogsController],
  providers: [CompanySettingsService, AccountSettingsService, AuditLogService],
  exports: [CompanySettingsService, AccountSettingsService, AuditLogService],
})
export class SettingsModule {}
