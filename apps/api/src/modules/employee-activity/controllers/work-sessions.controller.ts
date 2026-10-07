import { Controller, Get, Query } from '@nestjs/common';
import { type WorkSessionsQuery, WorkSessionsQuerySchema } from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { WorkSessionsService } from '../services/work-sessions.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('work-sessions')
export class WorkSessionsController {
  constructor(private readonly sessions: WorkSessionsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query(new ZodQuery(WorkSessionsQuerySchema)) q: WorkSessionsQuery) {
    return this.sessions.list(auth.companyId, q);
  }
}
