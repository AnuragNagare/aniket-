import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';
import { RetentionService } from '../../src/modules/privacy/services/retention.service.js';

describe('Location retention purge service (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let retentionService: RetentionService;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);
    retentionService = app.get(RetentionService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('purges location points older than each company retention setting in batches', async () => {
    const adminA = await signupAs(app);
    const adminB = await signupAs(app);

    // Set A to 90 days (default) and B to 30 days
    await prisma.company.update({
      where: { id: adminA.user.companyId },
      data: { preciseLocationRetentionDays: 90 },
    });
    await prisma.company.update({
      where: { id: adminB.user.companyId },
      data: { preciseLocationRetentionDays: 30 },
    });

    const empA = await employeeAs(app, prisma, adminA.user.companyId);
    const empB = await employeeAs(app, prisma, adminB.user.companyId);

    const now = new Date();
    const d10 = subDays(now, 10);
    const d45 = subDays(now, 45);
    const d120 = subDays(now, 120);

    // Create session for empA and empB
    const sessA = await prisma.workSession.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        startedAtServer: d120,
      },
    });
    const sessB = await prisma.workSession.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empB.employee.id,
        startedAtServer: d120,
      },
    });

    // Create updates for empA and empB to ensure they are untouched
    const updateA = await prisma.workUpdate.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: sessA.id,
        clientUpdateId: randomUUID(),
        text: 'Work update 120 days ago',
        inputMethod: 'TYPED',
        submittedAt: d120,
      },
    });
    const updateB = await prisma.workUpdate.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empB.employee.id,
        sessionId: sessB.id,
        clientUpdateId: randomUUID(),
        text: 'Work update 120 days ago',
        inputMethod: 'TYPED',
        submittedAt: d120,
      },
    });

    // Seed points at 10, 45, and 120 days old for both companies
    // For Company A:
    const ptA10 = await prisma.locationPoint.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: sessA.id,
        clientPointId: randomUUID(),
        latitude: 19.01,
        longitude: 72.85,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d10,
        receivedAt: d10,
      },
    });
    const ptA45 = await prisma.locationPoint.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: sessA.id,
        clientPointId: randomUUID(),
        latitude: 19.02,
        longitude: 72.86,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d45,
        receivedAt: d45,
      },
    });
    const ptA120 = await prisma.locationPoint.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: sessA.id,
        clientPointId: randomUUID(),
        latitude: 19.03,
        longitude: 72.87,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d120,
        receivedAt: d120,
      },
    });

    // For Company B:
    const ptB10 = await prisma.locationPoint.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empB.employee.id,
        sessionId: sessB.id,
        clientPointId: randomUUID(),
        latitude: 19.04,
        longitude: 72.88,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d10,
        receivedAt: d10,
      },
    });
    const ptB45 = await prisma.locationPoint.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empB.employee.id,
        sessionId: sessB.id,
        clientPointId: randomUUID(),
        latitude: 19.05,
        longitude: 72.89,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d45,
        receivedAt: d45,
      },
    });
    const ptB120 = await prisma.locationPoint.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empB.employee.id,
        sessionId: sessB.id,
        clientPointId: randomUUID(),
        latitude: 19.06,
        longitude: 72.90,
        source: 'BACKGROUND',
        qualityFlag: 'GOOD',
        capturedAt: d120,
        receivedAt: d120,
      },
    });

    // Also seed 12,000 old points (> 120 days old) in Company B to test batched loop (BATCH=5000)
    const extraPoints = Array.from({ length: 12_000 }, () => ({
      companyId: adminB.user.companyId,
      employeeId: empB.employee.id,
      sessionId: sessB.id,
      clientPointId: randomUUID(),
      latitude: 19.10,
      longitude: 72.90,
      source: 'BACKGROUND' as const,
      qualityFlag: 'GOOD' as const,
      capturedAt: subDays(now, 150),
      receivedAt: subDays(now, 150),
    }));
    await prisma.locationPoint.createMany({ data: extraPoints });

    // Execute retention purge
    const results = await retentionService.run(now);

    const resA = results.find((r) => r.companyId === adminA.user.companyId);
    const resB = results.find((r) => r.companyId === adminB.user.companyId);

    // Company A: 90 days retention -> deleted 1 point (ptA120)
    expect(resA?.deleted).toBe(1);
    // Company B: 30 days retention -> deleted ptB45, ptB120 + 12000 points = 12,002
    expect(resB?.deleted).toBe(12_002);

    // Verify Company A kept 10-day and 45-day points, deleted 120-day point
    const ptsA = await prisma.locationPoint.findMany({
      where: { companyId: adminA.user.companyId },
      select: { id: true },
    });
    const idsA = ptsA.map((p) => p.id);
    expect(idsA).toContain(ptA10.id);
    expect(idsA).toContain(ptA45.id);
    expect(idsA).not.toContain(ptA120.id);

    // Verify Company B kept only 10-day point
    const ptsB = await prisma.locationPoint.findMany({
      where: { companyId: adminB.user.companyId },
      select: { id: true },
    });
    const idsB = ptsB.map((p) => p.id);
    expect(idsB).toContain(ptB10.id);
    expect(idsB).not.toContain(ptB45.id);
    expect(idsB).not.toContain(ptB120.id);

    // Verify sessions and updates are completely untouched
    const checkSessA = await prisma.workSession.findUnique({ where: { id: sessA.id } });
    const checkSessB = await prisma.workSession.findUnique({ where: { id: sessB.id } });
    const checkUpdA = await prisma.workUpdate.findUnique({ where: { id: updateA.id } });
    const checkUpdB = await prisma.workUpdate.findUnique({ where: { id: updateB.id } });
    expect(checkSessA).not.toBeNull();
    expect(checkSessB).not.toBeNull();
    expect(checkUpdA).not.toBeNull();
    expect(checkUpdB).not.toBeNull();

    // Verify audit logs for both companies
    const auditA = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'retention.purged' },
    });
    const auditB = await prisma.auditLog.findFirst({
      where: { companyId: adminB.user.companyId, action: 'retention.purged' },
    });
    expect(auditA).not.toBeNull();
    expect(auditB).not.toBeNull();
    expect(auditA?.metadata).toMatchObject({ deleted: 1 });
    expect(auditB?.metadata).toMatchObject({ deleted: 12_002 });

    // Running again deletes 0 and writes NO new audit rows
    const countAuditBefore = await prisma.auditLog.count({ where: { action: 'retention.purged' } });
    const results2 = await retentionService.run(now);
    const countAuditAfter = await prisma.auditLog.count({ where: { action: 'retention.purged' } });

    expect(results2.find((r) => r.companyId === adminA.user.companyId)?.deleted).toBe(0);
    expect(results2.find((r) => r.companyId === adminB.user.companyId)?.deleted).toBe(0);
    expect(countAuditAfter).toBe(countAuditBefore);
  });
});
