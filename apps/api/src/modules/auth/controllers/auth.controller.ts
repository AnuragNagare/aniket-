import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminSignupInput,
  AdminSignupSchema,
  type LoginInput,
  LoginSchema,
  type RefreshInput,
  RefreshSchema,
} from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../decorators/current-auth.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import { AuthService } from '../services/auth.service.js';
import { TokensService } from '../services/tokens.service.js';
import type { AuthContext } from '../types/auth-context.js';

// Strict in real use; relaxed under test so suites that sign up many companies don't hit 429.
const AUTH_LIMIT = {
  default: { limit: process.env.NODE_ENV === 'test' ? 10_000 : 10, ttl: 60_000 },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('signup/admin')
  signup(@Body(new ZodBody(AdminSignupSchema)) body: AdminSignupInput) {
    return this.auth.signupAdmin(body);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodBody(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodBody(RefreshSchema)) body: RefreshInput) {
    return this.tokens.rotate(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodBody(RefreshSchema)) body: RefreshInput) {
    await this.tokens.revoke(body.refreshToken);
  }

  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId);
  }
}
