import { Controller, Get, Query } from '@nestjs/common';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { DashboardService } from '../services/dashboard.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext, @Query('date') date?: string) {
    return this.dashboard.get(auth.companyId, date);
  }
}
