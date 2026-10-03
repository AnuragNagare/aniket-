import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../types/auth-context.js';

/** Injects the caller's AuthContext into a route handler. */
export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext =>
    ctx.switchToHttp().getRequest<{ auth: AuthContext }>().auth,
);
