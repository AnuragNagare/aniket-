import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { EmployeesService, type EmployeeStatus } from '../services/employees.service.js';

const clampInt = (value: string | undefined, fallback: number, max: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

const asStatus = (s?: string): EmployeeStatus | undefined =>
  s === 'WORKING' || s === 'OFF_DUTY' ? s : undefined;

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query('query') query?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.employees.list(auth.companyId, {
      query: query?.trim() || undefined,
      status: asStatus(status),
      page: clampInt(page, 1, 10_000),
      pageSize: clampInt(pageSize, 20, 100),
    });
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.employees.get(auth.companyId, id);
  }
}
