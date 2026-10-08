import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ClsServiceManager } from 'nestjs-cls';
import { CLS_COMPANY_ID, CLS_USER_ID } from '../../../common/context/request-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ENV, type Env } from '../../../config/env.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { UserStatusCache } from '../services/user-status-cache.service.js';
import type { AccessTokenClaims, AuthContext } from '../types/auth-context.js';

type AuthedRequest = { headers: Record<string, string | undefined>; auth?: AuthContext };

/** Global guard: every route needs a valid bearer token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly userStatusCache: UserStatusCache,
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

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Sign in again.');
    }

    const status = await this.userStatusCache.getStatus(claims.sub);
    if (status === 'DISABLED') {
      throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled.');
    }

    req.auth = { userId: claims.sub, companyId: claims.cid, role: claims.role };
    try {
      const cls = ClsServiceManager.getClsService();
      if (cls?.isActive()) {
        cls.set(CLS_USER_ID, claims.sub);
        cls.set(CLS_COMPANY_ID, claims.cid);
      }
    } catch {
      // no-op if outside active CLS context
    }
    return true;
  }
}

