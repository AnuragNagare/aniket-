import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { ChangePasswordInput, UpdateAccountInput } from '@worktrail/types';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

@Injectable()
export class AccountSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async updateAccount(auth: AuthContext, input: UpdateAccountInput) {
    const user = await this.prisma.user.update({
      where: { id: auth.userId },
      data: {
        name: input.name ?? undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
      },
    });

    await this.prisma.employee.updateMany({
      where: { userId: auth.userId },
      data: {
        name: input.name ?? undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
      },
    });

    const changed = [
      input.name !== undefined ? 'name' : null,
      input.phone !== undefined ? 'phone' : null,
    ].filter(Boolean);

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'account.updated',
      entityType: 'user',
      entityId: auth.userId,
      metadata: { changed },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  }

  async changePassword(auth: AuthContext, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });

    const valid = await argon2.verify(user.passwordHash, input.current);
    if (!valid) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Your current password is incorrect.');
    }

    const passwordHash = await argon2.hash(input.next, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: auth.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: auth.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'password.changed',
      entityType: 'user',
      entityId: auth.userId,
    });

    return { ok: true };
  }
}
