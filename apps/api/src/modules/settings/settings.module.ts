import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { CompanyController } from './controllers/company.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { CompanySettingsService } from './services/company-settings.service.js';
import { AccountSettingsService } from './services/account-settings.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CompanyController, AccountController],
  providers: [CompanySettingsService, AccountSettingsService],
  exports: [CompanySettingsService, AccountSettingsService],
})
export class SettingsModule {}
