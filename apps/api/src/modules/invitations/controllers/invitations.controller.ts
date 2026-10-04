import { Body, Controller, Param, Post } from '@nestjs/common';
import { type InviteEmployeeInput, InviteEmployeeSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { InvitationsService } from '../services/invitations.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('invitations')
  invite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(InviteEmployeeSchema)) body: InviteEmployeeInput,
  ) {
    return this.invitations.invite(auth, body);
  }

  @Post(':employeeId/invitations')
  resend(@CurrentAuth() auth: AuthContext, @Param('employeeId') employeeId: string) {
    return this.invitations.resend(auth, employeeId);
  }
}
