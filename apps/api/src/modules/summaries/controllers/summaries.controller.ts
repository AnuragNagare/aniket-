import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  type DateRange,
  type PeriodSummaryDto,
  type SummaryQuery,
  CreateSummarySchema,
  SummaryQuerySchema,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { PeriodSummaryService } from '../services/period-summary.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees/:employeeId/summaries')
export class SummariesController {
  constructor(private readonly periodSummaryService: PeriodSummaryService) {}

  @Get()
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId') employeeId: string,
    @Query(new ZodQuery(SummaryQuerySchema)) q: SummaryQuery,
    @Res() res: Response,
  ): Promise<void> {
    const summary = await this.periodSummaryService.get(auth.companyId, employeeId, q);
    res.json(summary);
  }

  @Post()
  @HttpCode(202)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId') employeeId: string,
    @Body(new ZodBody(CreateSummarySchema)) body: DateRange,
    @Query('refresh') refresh?: string,
  ): Promise<PeriodSummaryDto> {
    return this.periodSummaryService.request(auth, employeeId, body, {
      refresh: refresh === '1' || refresh === 'true',
    });
  }
}
