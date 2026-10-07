import { Module } from '@nestjs/common';
import { CurrentEmployeeService } from '../sessions/services/current-employee.service.js';
import { MeController } from './controllers/me.controller.js';
import { HistoryService } from './services/history.service.js';
import { MeService } from './services/me.service.js';

@Module({
  controllers: [MeController],
  providers: [MeService, HistoryService, CurrentEmployeeService],
})
export class MeModule {}
