import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type DateRange,
  DateRangeSchema,
  type EmployeeUpdatesQuery,
  EmployeeUpdatesQuerySchema,
} from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ActivityService } from '../services/activity.service.js';
import { TrailService } from '../services/trail.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees/:employeeId')
export class EmployeeActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly trailService: TrailService,
  ) {}

  @Get('location-trail')
  trail(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.trailService.trail(auth.companyId, id, q);
  }

  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.activity.sessions(auth.companyId, id, q);
  }

  @Get('summary')
  summary(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.activity.summary(auth.companyId, id, q);
  }

  @Get('updates')
  updates(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId') id: string,
    @Query(new ZodQuery(EmployeeUpdatesQuerySchema)) q: EmployeeUpdatesQuery,
  ) {
    return this.activity.updates(auth.companyId, id, q);
  }
}
