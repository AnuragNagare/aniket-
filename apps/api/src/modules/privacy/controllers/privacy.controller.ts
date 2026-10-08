import { Controller, Get } from '@nestjs/common';
import type { PrivacyNotice } from '@worktrail/types';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { getPrivacyNotice } from '../notice.js';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('notice')
  async getNotice(@CurrentAuth() auth: AuthContext): Promise<PrivacyNotice> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: auth.companyId },
      select: { name: true, preciseLocationRetentionDays: true },
    });
    return getPrivacyNotice(company.name, company.preciseLocationRetentionDays);
  }
}
