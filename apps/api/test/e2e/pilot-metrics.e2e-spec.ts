import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';
import { pilotMetrics } from '../../scripts/pilot-metrics.js';

describe('pilot metrics calculation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('calculates PRD §8 pilot targets, handles edge cases and active weeks', async () => {
    await resetDb(prisma);

    // Company A: will have active sessions and updates
    const adminA = await signupAs(app, { companyName: 'Company Alpha' });
    const compAId = adminA.user.companyId;
    const empA = await employeeAs(app, prisma, compAId);

    // Company B: empty edge case company (zero sessions, zero reports)
    const adminB = await signupAs(app, { companyName: 'Company Beta' });
    const compBId = adminB.user.companyId;

    const t0 = new Date('2026-11-02T09:00:00.000Z'); // Monday 9am
    const tEnd = new Date('2026-11-28T23:59:59.000Z');

    // 1. Session 1 for Company A: starts at t0, first point at t0 + 60s (within 2 min)
    const s1 = await prisma.workSession.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        startedAtServer: t0,
        status: 'COMPLETED',
        totalMinutes: 120,
      },
    });
    await prisma.locationPoint.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        sessionId: s1.id,
        clientPointId: randomUUID(),
        latitude: 19.076,
        longitude: 72.877,
        source: 'START',
        qualityFlag: 'GOOD',
        capturedAt: new Date(t0.getTime() + 60_000), // 1 min after start
        receivedAt: new Date(t0.getTime() + 60_000),
      },
    });

    // 2. Session 2 for Company A: starts at t0 + 1 day, first point at + 300s (delayed > 2 min)
    const t1 = new Date(t0.getTime() + 86_400_000);
    const s2 = await prisma.workSession.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        startedAtServer: t1,
        status: 'COMPLETED',
        totalMinutes: 60,
      },
    });
    await prisma.locationPoint.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        sessionId: s2.id,
        clientPointId: randomUUID(),
        latitude: 19.076,
        longitude: 72.877,
        source: 'START',
        qualityFlag: 'GOOD',
        capturedAt: new Date(t1.getTime() + 300_000), // 5 min after start
        receivedAt: new Date(t1.getTime() + 300_000),
      },
    });

    // 3. Session 3 for Company A: session with NO points (edge case)
    const t2 = new Date(t0.getTime() + 2 * 86_400_000);
    await prisma.workSession.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        startedAtServer: t2,
        status: 'COMPLETED',
        totalMinutes: 45,
      },
    });

    // Workday updates:
    // Day 0 has an update with summary completed in 40s (<= 60s)
    await prisma.workUpdate.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        sessionId: s1.id,
        clientUpdateId: randomUUID(),
        text: 'Visited first site',
        category: 'SITE_VISIT',
        inputMethod: 'TYPED',
        submittedAt: new Date(t0.getTime() + 3600_000),
        summaryStatus: 'COMPLETE',
        summaryGeneratedAt: new Date(t0.getTime() + 3600_000 + 40_000),
      },
    });
    // Day 1 has an update still QUEUED (excluded from completed 60s denominator)
    await prisma.workUpdate.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        sessionId: s2.id,
        clientUpdateId: randomUUID(),
        text: 'Client discussion complete',
        category: 'CLIENT_MEETING',
        inputMethod: 'VOICE',
        submittedAt: new Date(t1.getTime() + 1800_000),
        summaryStatus: 'QUEUED',
      },
    });
    // Day 2 has NO update. Total workdays = 3, updated = 2 -> 66.7%

    // Reports:
    // Report 1: generated in 12s (< 30s)
    await prisma.report.create({
      data: {
        companyId: compAId,
        employeeId: empA.employee.id,
        requestedByUserId: adminA.user.id,
        periodStart: t0,
        periodEnd: t1,
        status: 'READY',
        createdAt: t0,
        generatedAt: new Date(t0.getTime() + 12_000),
      },
    });

    // Admin login audit log for week 1
    await prisma.auditLog.create({
      data: {
        companyId: compAId,
        actorUserId: adminA.user.id,
        action: 'admin.signed_in',
        entityType: 'user',
        entityId: adminA.user.id,
        createdAt: new Date(t0.getTime() + 10_000),
      },
    });

    // Compute metrics
    const results = await pilotMetrics(prisma, { from: t0, to: tEnd });
    expect(results).toHaveLength(2);

    const metricsA = results.find((r) => r.companyId === compAId)!;
    expect(metricsA).toBeDefined();
    expect(metricsA.companyName).toBe('Company Alpha');
    expect(metricsA.activeEmployees).toBe(1);
    // 1 of 3 sessions had first point within 2 min = 33.3%
    expect(metricsA.firstPointWithin2MinPct).toBe(33.3);
    // 2 of 3 workdays had updates = 66.7%
    expect(metricsA.workdaysWithUpdatePct).toBe(66.7);
    // 1 completed summary in 40s (QUEUED ignored) = 100%
    expect(metricsA.summariesWithin60sPct).toBe(100);
    // 1 report generated in 12s = 12s
    expect(metricsA.reportP95Seconds).toBe(12);
    // Week 1 has 3 sessions and admin login
    expect(metricsA.activeWeeks).toContain(1);

    // Verify Company B edge cases (zero sessions, zero reports)
    const metricsB = results.find((r) => r.companyId === compBId)!;
    expect(metricsB).toBeDefined();
    expect(metricsB.firstPointWithin2MinPct).toBe('n/a');
    expect(metricsB.workdaysWithUpdatePct).toBe('n/a');
    expect(metricsB.summariesWithin60sPct).toBe('n/a');
    expect(metricsB.reportP95Seconds).toBe('n/a');
    expect(metricsB.activeWeeks).toEqual([]);
  });
});
