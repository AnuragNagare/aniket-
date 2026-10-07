import { Module } from '@nestjs/common';
import { EmployeeActivityController } from './controllers/employee-activity.controller.js';
import { ActivityService } from './services/activity.service.js';
import { EmployeeAccessService } from './services/employee-access.service.js';

@Module({
  controllers: [EmployeeActivityController],
  providers: [EmployeeAccessService, ActivityService],
  exports: [EmployeeAccessService, ActivityService],
})
export class EmployeeActivityModule {}
