import { Body, Controller, Post } from '@nestjs/common';
import { type ConsentInput, ConsentSchema, type ConsentDto } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ConsentService } from '../services/consent.service.js';

@Roles('EMPLOYEE')
@Controller('me')
export class MePrivacyController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('consent')
  async recordConsent(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(ConsentSchema)) body: ConsentInput,
  ): Promise<ConsentDto> {
    return this.consentService.record(auth, body);
  }
}
