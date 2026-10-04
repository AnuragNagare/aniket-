import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AcceptInvitationInput, AcceptInvitationSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import { InvitationsService } from '../services/invitations.service.js';

const LIMIT = { default: { limit: process.env.NODE_ENV === 'test' ? 10_000 : 20, ttl: 60_000 } };

/** Reached from the invite link, before the employee has an account. */
@Public()
@Throttle(LIMIT)
@Controller('employees/invitations')
export class AcceptInvitationController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(
    @Param('token') token: string,
    @Body(new ZodBody(AcceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.invitations.accept(token, body);
  }
}
