import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../../common/audit/audit.service.js';

const BATCH = 5000;

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Deletes precise locations older than each company's retention period, 5,000 rows at a time. */
  async run(now = new Date()): Promise<Array<{ companyId: string; deleted: number }>> {
    const companies = await this.prisma.company.findMany({
      select: { id: true, preciseLocationRetentionDays: true },
    });
    const results: Array<{ companyId: string; deleted: number }> = [];

    for (const c of companies) {
      const cutoff = new Date(now.getTime() - c.preciseLocationRetentionDays * 86_400_000);
      let deleted = 0;
      for (;;) {
        const n = await this.prisma.$executeRaw`
          DELETE FROM location_points WHERE id IN (
            SELECT id FROM location_points WHERE company_id = ${c.id}::uuid AND captured_at < ${cutoff}
            LIMIT ${BATCH})`;
        deleted += n;
        if (n < BATCH) break;
      }
      if (deleted > 0) {
        await this.audit.record({
          companyId: c.id,
          action: 'retention.purged',
          entityType: 'company',
          entityId: c.id,
          metadata: { deleted, cutoff: cutoff.toISOString() },
        });
      }
      results.push({ companyId: c.id, deleted });
    }

    return results;
  }
}
