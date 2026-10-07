import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type CreateUpdateInput, CreateUpdateSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { UpdatesService } from '../services/updates.service.js';

@Roles('EMPLOYEE')
@Controller('updates')
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(CreateUpdateSchema)) body: CreateUpdateInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.updates.create(auth, body);
    res.status(result.duplicate ? 200 : 201);
    return result;
  }
}
