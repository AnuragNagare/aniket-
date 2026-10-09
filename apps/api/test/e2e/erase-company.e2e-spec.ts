import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { FILE_STORAGE, type FileStorage } from '../../src/common/storage/file-storage.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';
import { eraseCompany } from '../../scripts/erase-company.js';

describe('Ops: erase company (e2e)', () => {
  let app: INestApplication;
  let storage: FileStorage;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    storage = app.get<FileStorage>(FILE_STORAGE);
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('fails when confirmation name does not match exact company name', async () => {
    const adminA = await signupAs(app);
    await expect(
      eraseCompany(prisma, storage, adminA.user.companyId, { confirm: 'Wrong Company Name' }),
    ).rejects.toThrow(/mismatch/i);
  });

  it('erases entire company on request, keeping only audit logs and company.erased, leaving other companies untouched', async () => {
    // 1. Setup Company A with 2 employees, sessions, reports, exports, summaries
    const adminA = await signupAs(app);
    const companyAId = adminA.user.companyId;
    const companyA = await prisma.company.findUniqueOrThrow({ where: { id: companyAId } });
    const companyAName = companyA.name;

    const empA1 = await employeeAs(app, prisma, companyAId);
    await employeeAs(app, prisma, companyAId);

    // Seed session, points, update for empA1
    const sessionA1 = await prisma.workSession.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        status: 'ACTIVE',
        startedAtServer: new Date('2026-10-01T08:00:00Z'),
      },
    });

    await prisma.locationPoint.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        sessionId: sessionA1.id,
        clientPointId: '00000000-0000-0000-0000-000000000001',
        latitude: 12.9716,
        longitude: 77.5946,
        capturedAt: new Date('2026-10-01T08:05:00Z'),
        source: 'START',
      },
    });

    await prisma.workUpdate.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        sessionId: sessionA1.id,
        clientUpdateId: '00000000-0000-0000-0000-000000000001',
        text: 'Started initial customer visits',
        submittedAt: new Date('2026-10-01T08:10:00Z'),
        inputMethod: 'TYPED',
      },
    });

    const summaryA = await prisma.generatedSummary.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        periodType: 'DAILY',
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-10-02'),
        sourceUpdateCount: 1,
        sourceSessionMinutes: 60,
        content: 'Day summary for employee 1',
        status: 'COMPLETE',
      },
    });

    const reportAKey = `${companyAId}/00000000-0000-0000-0000-000000000001.pdf`;
    await storage.put(reportAKey, Buffer.from('%PDF-1.4 report content'));
    await prisma.report.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        requestedByUserId: adminA.user.id,
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-10-02'),
        status: 'READY',
        storageKey: reportAKey,
        summaryId: summaryA.id,
      },
    });

    const exportAKey = `${companyAId}/00000000-0000-0000-0000-000000000002.zip`;
    await storage.put(exportAKey, Buffer.from('PK-zip export data'));
    await prisma.dataExport.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        requestedByUserId: adminA.user.id,
        status: 'READY',
        storageKey: exportAKey,
      },
    });

    await prisma.deletionRequest.create({
      data: {
        companyId: companyAId,
        employeeId: empA1.employee.id,
        reason: 'Leaving organization',
      },
    });

    // 2. Setup Company B with 1 employee, session
    const adminB = await signupAs(app);
    const companyBId = adminB.user.companyId;
    const empB = await employeeAs(app, prisma, companyBId);

    const sessionB = await prisma.workSession.create({
      data: {
        companyId: companyBId,
        employeeId: empB.employee.id,
        status: 'ACTIVE',
        startedAtServer: new Date('2026-10-02T09:00:00Z'),
      },
    });

    // 3. Execute eraseCompany for Company A
    const res = await eraseCompany(prisma, storage, companyAId, { confirm: companyAName });
    expect(res.employeesErased).toBe(2);

    // 4. Verify Company A records are purged
    const remainingSessionsA = await prisma.workSession.count({ where: { companyId: companyAId } });
    expect(remainingSessionsA).toBe(0);

    const remainingPointsA = await prisma.locationPoint.count({ where: { companyId: companyAId } });
    expect(remainingPointsA).toBe(0);

    const remainingUpdatesA = await prisma.workUpdate.count({ where: { companyId: companyAId } });
    expect(remainingUpdatesA).toBe(0);

    const remainingSummariesA = await prisma.generatedSummary.count({ where: { companyId: companyAId } });
    expect(remainingSummariesA).toBe(0);

    const remainingReportsA = await prisma.report.count({ where: { companyId: companyAId } });
    expect(remainingReportsA).toBe(0);

    const remainingExportsA = await prisma.dataExport.count({ where: { companyId: companyAId } });
    expect(remainingExportsA).toBe(0);

    const remainingUsersA = await prisma.user.count({ where: { companyId: companyAId } });
    expect(remainingUsersA).toBe(0);

    const remainingInvitationsA = await prisma.invitation.count({ where: { companyId: companyAId } });
    expect(remainingInvitationsA).toBe(0);

    // Verify storage files for Company A are removed
    await expect(storage.stream(reportAKey)).rejects.toMatchObject({ status: 404 });
    await expect(storage.stream(exportAKey)).rejects.toMatchObject({ status: 404 });

    // Verify Company A row updated
    const companyARow = await prisma.company.findUnique({ where: { id: companyAId } });
    expect(companyARow?.name).toBe('Deleted company');
    expect(companyARow?.preciseLocationRetentionDays).toBe(30);

    // Verify Company A audit logs preserved, with company.erased recorded
    const auditA = await prisma.auditLog.findMany({ where: { companyId: companyAId } });
    expect(auditA.length).toBeGreaterThan(0);
    const erasedAudit = auditA.find((a) => a.action === 'company.erased');
    expect(erasedAudit).toBeDefined();

    // 5. Verify Company B is completely untouched
    const companyBRow = await prisma.company.findUnique({ where: { id: companyBId } });
    expect(companyBRow?.name).not.toBe('Deleted company');

    const userB = await prisma.user.findUnique({ where: { id: adminB.user.id } });
    expect(userB).not.toBeNull();

    const sessionBRow = await prisma.workSession.findUnique({ where: { id: sessionB.id } });
    expect(sessionBRow?.status).toBe('ACTIVE');

    const empBRow = await prisma.employee.findUnique({ where: { id: empB.employee.id } });
    expect(empBRow?.deletedAt).toBeNull();
  });
});
