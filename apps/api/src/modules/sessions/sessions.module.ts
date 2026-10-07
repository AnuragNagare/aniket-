import { Module } from '@nestjs/common';
import { LocationsController } from './controllers/locations.controller.js';
import { SessionsController } from './controllers/sessions.controller.js';
import { CurrentEmployeeService } from './services/current-employee.service.js';
import { LocationsService } from './services/locations.service.js';
import { SessionsService } from './services/sessions.service.js';

@Module({
  controllers: [SessionsController, LocationsController],
  providers: [SessionsService, LocationsService, CurrentEmployeeService],
  exports: [CurrentEmployeeService],
})
export class SessionsModule {}
