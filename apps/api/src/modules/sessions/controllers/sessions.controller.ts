import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  type EndSessionInput,
  EndSessionSchema,
  type StartSessionInput,
  StartSessionSchema,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { SessionsService } from '../services/sessions.service.js';

@Roles('EMPLOYEE')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('me/active')
  active(@CurrentAuth() auth: AuthContext) {
    return this.sessions.active(auth);
  }

  @Post('start')
  start(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(StartSessionSchema)) body: StartSessionInput,
  ) {
    return this.sessions.start(auth, body);
  }

  @Post(':sessionId/end')
  @HttpCode(200)
  end(
    @CurrentAuth() auth: AuthContext,
    @Param('sessionId') sessionId: string,
    @Body(new ZodBody(EndSessionSchema)) body: EndSessionInput,
  ) {
    return this.sessions.end(auth, sessionId, body);
  }
}
