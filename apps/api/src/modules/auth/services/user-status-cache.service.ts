import { Injectable } from '@nestjs/common';
import type { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class UserStatusCache {
  private readonly cache = new Map<string, { status: UserStatus; cachedAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<UserStatus | null> {
    const ttl =
      process.env.AUTH_CACHE_TTL_MS !== undefined
        ? Number(process.env.AUTH_CACHE_TTL_MS)
        : 60_000;

    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.cachedAt < ttl) {
      return hit.status;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user) return null;

    if (ttl > 0) {
      this.cache.set(userId, { status: user.status, cachedAt: Date.now() });
    }
    return user.status;
  }

  invalidate(userId: string) {
    this.cache.delete(userId);
  }
}
