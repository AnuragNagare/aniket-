import { Body, Controller, HttpCode, Patch, Post } from '@nestjs/common';
import {
  type ChangePasswordInput,
  ChangePasswordSchema,
  type UpdateAccountInput,
  UpdateAccountSchema,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { AccountSettingsService } from '../services/account-settings.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('me')
export class AccountController {
  constructor(private readonly accountSettings: AccountSettingsService) {}

  @Patch('account')
  updateAccount(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(UpdateAccountSchema)) body: UpdateAccountInput,
  ) {
    return this.accountSettings.updateAccount(auth, body);
  }

  @HttpCode(200)
  @Post('password')
  changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(ChangePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.accountSettings.changePassword(auth, body);
  }
}
