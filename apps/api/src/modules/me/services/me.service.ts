import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toAuthUser } from '../../auth/services/tokens.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(auth: AuthContext): Promise<MeResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId, status: 'ACTIVE' },
      include: { employee: true, company: true },
    });
    if (!user) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    const e = user.employee;
    return {
      user: toAuthUser(user),
      employee: e
        ? {
            id: e.id,
            name: e.name,
            designation: e.designation,
            employeeCode: e.employeeCode,
            phone: e.phone,
          }
        : null,
      company: { name: user.company.name, timezone: user.company.timezone },
    };
  }
}
