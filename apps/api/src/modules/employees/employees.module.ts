import { Module } from '@nestjs/common';
import { EmployeesController } from './controllers/employees.controller.js';
import { EmployeesService } from './services/employees.service.js';

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}
