import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../../../common/errors/app-error.js';
import { ENV, type Env } from '../../../config/env.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import type { AccessTokenClaims, AuthContext } from '../types/auth-context.js';

type AuthedRequest = { headers: Record<string, string | undefined>; auth?: AuthContext };

/** Global guard: every route needs a valid bearer token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');

    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      req.auth = { userId: claims.sub, companyId: claims.cid, role: claims.role };
      return true;
    } catch {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Sign in again.');
    }
  }
}
