import { Inject, Injectable } from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { Mailer } from '../../../common/mail/mailer.js';
import { newToken, sha256 } from '../../../common/utils/secure-token.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { hashPassword } from '../utils/password.js';

export const RESET_TTL_MINUTES = 60;

const linkInvalid = () =>
  new AppError(
    400,
    'RESET_LINK_INVALID',
    'This reset link has expired or was already used. Request a new one.',
  );

/** Forgot-password flow: single-use, 1-hour links; a reset signs the user out everywhere. */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Always resolves the same way, so callers can't learn which emails have accounts. */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = newToken();
    await this.prisma.$transaction([
      // Only the newest link works.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: addMinutes(new Date(), RESET_TTL_MINUTES),
        },
      }),
    ]);

    await this.mailer
      .send({
        to: user.email,
        subject: 'Reset your Work Trail password',
        text: [
          `Hi ${user.name},`,
          '',
          'Open this link to choose a new password. It works once and expires in 1 hour:',
          `${this.env.WEB_ORIGIN}/reset-password?token=${token}`,
          '',
          "If you didn't ask for this, ignore this email. Your password stays the same.",
        ].join('\n'),
      })
      .catch(() => undefined);
  }

  async reset(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw linkInvalid();

      const row = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        include: { user: true },
      });
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          companyId: row.user.companyId,
          actorUserId: row.userId,
          action: 'password.reset',
          entityType: 'user',
          entityId: row.userId,
        },
        tx,
      );
    });
  }
}
