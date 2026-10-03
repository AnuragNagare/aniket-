import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { AuthTokens, AuthUser } from '@worktrail/types';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { addDays } from 'date-fns';
import { AppError } from '../../../common/errors/app-error.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AccessTokenClaims } from '../types/auth-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const sessionExpired = () =>
  new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  role: u.role,
  companyId: u.companyId,
  name: u.name,
  email: u.email,
});

/**
 * Issues short-lived JWT access tokens and opaque, rotating refresh tokens
 * (`<id>.<secret>`, only a SHA-256 of the secret is stored).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issue(user: User): Promise<AuthTokens> {
    const claims: AccessTokenClaims = { sub: user.id, cid: user.companyId, role: user.role };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
    });

    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        id,
        userId: user.id,
        tokenHash: sha256(secret),
        expiresAt: addDays(new Date(), this.env.REFRESH_TOKEN_TTL_DAYS),
      },
    });
    return { accessToken, refreshToken: `${id}.${secret}`, user: toAuthUser(user) };
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    const [id, secret] = refreshToken.split('.');
    if (!id || !secret || !UUID.test(id)) throw sessionExpired();

    const row = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!row || row.tokenHash !== sha256(secret)) throw sessionExpired();

    if (row.revokedAt) {
      // A rotated token came back: assume it was stolen and end every session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw sessionExpired();
    }
    if (row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw sessionExpired();

    // Claim the token atomically so two concurrent refreshes can't both succeed.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) throw sessionExpired();
    return this.issue(row.user);
  }

  async revoke(refreshToken: string): Promise<void> {
    const [id] = refreshToken.split('.');
    if (!id || !UUID.test(id)) return;
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
