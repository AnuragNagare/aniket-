import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AuthService } from './services/auth.service.js';
import { TokensService } from './services/tokens.service.js';

/**
 * Sign-up, sign-in and token lifecycle. Registers the global guards: every route
 * requires a valid access token unless marked @Public(), and @Roles() is enforced.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokensService],
})
export class AuthModule {}
