import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { ROLES } from '../decorators/roles.decorator.js';
import type { AuthContext } from '../types/auth-context.js';

/** Global guard: enforces @Roles(...) using the role from the verified token. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;

    const auth = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>().auth;
    if (!auth || !roles.includes(auth.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Your role does not allow this action.');
    }
    return true;
  }
}
