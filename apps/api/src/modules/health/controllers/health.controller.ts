import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma.service.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import { ENV, type Env } from '../../../config/env.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }

  @Public()
  @Get('ready')
  async ready() {
    let dbStatus: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
    if (this.env.QUEUE_DRIVER === 'bullmq') {
      try {
        if (!this.env.REDIS_URL) throw new Error('Missing REDIS_URL');
        const redis = new Redis(this.env.REDIS_URL, {
          connectTimeout: 2000,
          commandTimeout: 2000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          lazyConnect: true,
        });
        await redis.connect();
        const pong = await redis.ping();
        redis.disconnect();
        redisStatus = pong === 'PONG' ? 'up' : 'down';
      } catch {
        redisStatus = 'down';
      }
    }

    const isReady = dbStatus === 'up' && redisStatus !== 'down';
    if (!isReady) {
      throw new HttpException({ db: dbStatus, redis: redisStatus }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { db: dbStatus, redis: redisStatus };
  }
}
