import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { EraseEmployeeSchema, type EraseEmployeeInput } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ErasureService } from '../services/erasure.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class EraseController {
  constructor(private readonly erasureService: ErasureService) {}

  @HttpCode(202)
  @Post(':id/erase')
  erase(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodBody(EraseEmployeeSchema)) body: EraseEmployeeInput,
  ) {
    return this.erasureService.requestErasure(auth, id, body);
  }
}
