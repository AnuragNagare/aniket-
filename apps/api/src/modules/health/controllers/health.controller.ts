import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { Public } from '../../auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
