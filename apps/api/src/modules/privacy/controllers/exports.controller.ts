import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ExportsService } from '../services/exports.service.js';

@Roles('OWNER', 'ADMIN')
@Controller()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @HttpCode(202)
  @Post('employees/:id/exports')
  requestExport(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.exportsService.requestExport(auth, id);
  }

  @Get('exports/:id')
  getExport(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.exportsService.getExport(auth, id);
  }

  @Get('exports/:id/download')
  async download(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename, size } = await this.exportsService.download(auth, id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (size > 0) {
      res.setHeader('Content-Length', size.toString());
    }
    stream.pipe(res);
  }
}
