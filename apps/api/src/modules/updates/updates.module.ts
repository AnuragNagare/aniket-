import { Module } from '@nestjs/common';
import { CurrentEmployeeService } from '../sessions/services/current-employee.service.js';
import { UpdatesController } from './controllers/updates.controller.js';
import { UpdatesService } from './services/updates.service.js';

@Module({
  controllers: [UpdatesController],
  providers: [UpdatesService, CurrentEmployeeService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
