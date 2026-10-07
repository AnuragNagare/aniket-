import { Controller, Get, Query } from '@nestjs/common';
import { HistoryQuerySchema, type HistoryQuery } from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { HistoryService } from '../services/history.service.js';
import { MeService } from '../services/me.service.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly history: HistoryService,
  ) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext) {
    return this.me.get(auth);
  }

  @Roles('EMPLOYEE')
  @Get('history')
  getHistory(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodQuery(HistoryQuerySchema)) q: HistoryQuery,
  ) {
    return this.history.get(auth, q);
  }
}
