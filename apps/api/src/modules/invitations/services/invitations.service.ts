import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InvitationCreated, InviteEmployeeInput } from '@worktrail/types';
import { addDays } from 'date-fns';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { Mailer } from '../../../common/mail/mailer.js';
import { newToken, sha256 } from '../../../common/utils/secure-token.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

export const INVITE_TTL_DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Invitation lifecycle: create and re-send single-use, expiring invite links. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async invite(auth: AuthContext, input: InviteEmployeeInput): Promise<InvitationCreated> {
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new AppError(
        409,
        'EMAIL_TAKEN',
        'This email already has a Work Trail account. Use a different email.',
      );
    }
    const existing = await this.prisma.employee.findFirst({
      where: { companyId: auth.companyId, email: input.email },
    });
    if (existing) {
      throw new AppError(
        409,
        'ALREADY_INVITED',
        'This person is already on your team. Send them a new invite link from the Employees page.',
      );
    }

    const token = newToken();
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            companyId: auth.companyId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            designation: input.designation,
            employeeCode: input.employeeCode,
          },
        });
        const invitation = await tx.invitation.create({
          data: {
            companyId: auth.companyId,
            employeeId: created.id,
            tokenHash: sha256(token),
            expiresAt,
            createdByUserId: auth.userId,
          },
        });
        await this.audit.record(
          {
            companyId: auth.companyId,
            actorUserId: auth.userId,
            action: 'invitation.created',
            entityType: 'invitation',
            entityId: invitation.id,
          },
          tx,
        );
        return created;
      });
      return await this.deliver(auth.companyId, employee.id, employee.name, input.email, token, expiresAt);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(
          409,
          'EMPLOYEE_CODE_TAKEN',
          'Another employee already uses this employee ID.',
        );
      }
      throw e;
    }
  }

  async resend(auth: AuthContext, employeeId: string): Promise<InvitationCreated> {
    const employee = UUID.test(employeeId)
      ? await this.prisma.employee.findFirst({ where: { id: employeeId, companyId: auth.companyId } })
      : null;
    if (!employee) throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (employee.userId) {
      throw new AppError(409, 'ALREADY_JOINED', 'This employee has already set up their account.');
    }
    if (!employee.email) {
      throw new AppError(
        409,
        'EMAIL_MISSING',
        'Add an email for this employee before sending an invite.',
      );
    }

    const token = newToken();
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    await this.prisma.$transaction(async (tx) => {
      // The previous link stops working the moment a new one exists.
      await tx.invitation.updateMany({
        where: { employeeId: employee.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invitation = await tx.invitation.create({
        data: {
          companyId: auth.companyId,
          employeeId: employee.id,
          tokenHash: sha256(token),
          expiresAt,
          createdByUserId: auth.userId,
        },
      });
      await this.audit.record(
        {
          companyId: auth.companyId,
          actorUserId: auth.userId,
          action: 'invitation.resent',
          entityType: 'invitation',
          entityId: invitation.id,
        },
        tx,
      );
    });
    return this.deliver(auth.companyId, employee.id, employee.name, employee.email, token, expiresAt);
  }

  /** Builds the link and emails it. A failed email doesn't fail the invite: the admin can share the link. */
  private async deliver(
    companyId: string,
    employeeId: string,
    name: string,
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<InvitationCreated> {
    const inviteUrl = `${this.env.WEB_ORIGIN}/invite/${token}`;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    let emailSent = true;
    try {
      await this.mailer.send({
        to: email,
        subject: `${company.name} invited you to Work Trail`,
        text: [
          `Hi ${name},`,
          '',
          `${company.name} uses Work Trail to record work sessions and updates.`,
          'Open this link to set your password. It works once and expires in 7 days:',
          inviteUrl,
        ].join('\n'),
      });
    } catch {
      emailSent = false;
    }
    return { employeeId, inviteUrl, expiresAt: expiresAt.toISOString(), emailSent };
  }
}
