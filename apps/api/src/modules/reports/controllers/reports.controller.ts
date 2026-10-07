import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  CreateReportSchema,
  ReportsQuerySchema,
  type CreateReportInput,
  type ReportsQuery,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ReportsService } from '../services/reports.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(202)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(CreateReportSchema)) body: CreateReportInput,
  ) {
    const report = await this.reportsService.create(auth, body);
    return { report };
  }

  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodQuery(ReportsQuerySchema)) query: ReportsQuery,
  ) {
    return this.reportsService.list(auth.companyId, query);
  }

  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.reportsService.get(auth.companyId, id);
  }

  @Get(':id/download')
  async download(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename, size } = await this.reportsService.download(auth, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (size > 0) {
      res.setHeader('Content-Length', size.toString());
    }
    stream.pipe(res);
  }
}
