import { Module } from '@nestjs/common';
import { EmployeeActivityController } from './controllers/employee-activity.controller.js';
import { WorkSessionsController } from './controllers/work-sessions.controller.js';
import { ActivityService } from './services/activity.service.js';
import { CloseSessionService } from './services/close-session.service.js';
import { EmployeeAccessService } from './services/employee-access.service.js';
import { TrailService } from './services/trail.service.js';
import { WorkSessionsService } from './services/work-sessions.service.js';

@Module({
  controllers: [EmployeeActivityController, WorkSessionsController],
  providers: [
    EmployeeAccessService,
    ActivityService,
    TrailService,
    CloseSessionService,
    WorkSessionsService,
  ],
  exports: [
    EmployeeAccessService,
    ActivityService,
    TrailService,
    CloseSessionService,
    WorkSessionsService,
  ],
})
export class EmployeeActivityModule {}
