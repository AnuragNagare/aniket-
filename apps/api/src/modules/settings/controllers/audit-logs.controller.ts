import { Controller, Get, Query } from '@nestjs/common';
import { type AuditLogQuery, AuditLogQuerySchema } from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { AuditLogService } from '../services/audit-log.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodQuery(AuditLogQuerySchema)) query: AuditLogQuery,
  ) {
    return this.auditLogService.list(auth, query);
  }
}
