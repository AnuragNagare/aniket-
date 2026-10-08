import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminToolsController } from './controllers/admin-tools.controller.js';
import { AdminToolsService } from './services/admin-tools.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [AdminToolsController],
  providers: [AdminToolsService],
  exports: [AdminToolsService],
})
export class AdminToolsModule {}
