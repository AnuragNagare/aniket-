import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { AdminToolsService } from '../services/admin-tools.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class AdminToolsController {
  constructor(private readonly adminTools: AdminToolsService) {}

  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.adminTools.deactivate(auth, id);
  }

  @HttpCode(200)
  @Post(':id/reactivate')
  reactivate(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.adminTools.reactivate(auth, id);
  }

  @HttpCode(200)
  @Post(':id/password-reset')
  passwordReset(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.adminTools.passwordReset(auth, id);
  }
}
