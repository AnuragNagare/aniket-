import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  type DeletionRequestInput,
  DeletionRequestSchema,
  type DismissDeletionRequestInput,
  DismissDeletionRequestSchema,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { DeletionRequestsService } from '../services/deletion-requests.service.js';

@Controller()
export class DeletionRequestsController {
  constructor(private readonly deletionRequests: DeletionRequestsService) {}

  @Roles('EMPLOYEE')
  @Post('me/deletion-request')
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(DeletionRequestSchema)) body: DeletionRequestInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { request, created } = await this.deletionRequests.create(auth, body);
    res.status(created ? 201 : 200);
    return request;
  }

  @Roles('OWNER', 'ADMIN')
  @Get('deletion-requests')
  list(@CurrentAuth() auth: AuthContext) {
    return this.deletionRequests.list(auth);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('deletion-requests/:id/dismiss')
  dismiss(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodBody(DismissDeletionRequestSchema)) body: DismissDeletionRequestInput,
  ) {
    return this.deletionRequests.dismiss(auth, id, body);
  }
}
