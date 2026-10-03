import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminSignupInput, AuthTokens, AuthUser, LoginInput } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../utils/password.js';
import { TokensService, toAuthUser } from './tokens.service.js';

const emailTaken = () =>
  new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  /** Creates a company and its OWNER in one transaction, then signs them in. */
  async signupAdmin(input: AdminSignupInput): Promise<AuthTokens> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({ data: { name: input.companyName } });
        return tx.user.create({
          data: {
            companyId: company.id,
            role: 'OWNER',
            name: input.name,
            email: input.email,
            phone: input.phone,
            passwordHash,
          },
        });
      });
      return await this.tokens.issue(user);
    } catch (e) {
      // The unique email index is the source of truth, so two simultaneous sign-ups
      // with one email yield one account and one clean 409.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw emailTaken();
      }
      throw e;
    }
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user
      ? await verifyPassword(user.passwordHash, input.password)
      : await verifyAgainstDummy(input.password);
    if (!user || !ok) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(
        403,
        'ACCOUNT_DISABLED',
        'This account is disabled. Contact your company admin.',
      );
    }
    return this.tokens.issue(user);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
    return toAuthUser(user);
  }
}
