import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';
import { FILE_STORAGE, type FileStorage } from '../../src/common/storage/file-storage.js';

describe('Employee erasure (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let storage: FileStorage;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);
    storage = app.get<FileStorage>(FILE_STORAGE);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('permanently erases an employee: cleans storage, batched rows, anonymises user/employee, marks deletion requests DONE', async () => {
    const adminA = await signupAs(app);
    const empA = await employeeAs(app, prisma, adminA.user.companyId);

    // Seed session, points, updates, summaries, report, export, consent, deletion request
    const session = await prisma.workSession.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        startedAtServer: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.locationPoint.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: session.id,
        clientPointId: randomUUID(),
        latitude: 12.9716,
        longitude: 77.5946,
        source: 'START',
        capturedAt: new Date(),
      },
    });

    await prisma.workUpdate.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: session.id,
        clientUpdateId: randomUUID(),
        text: 'Initial update',
        inputMethod: 'TYPED',
        submittedAt: new Date(),
      },
    });

    const summary = await prisma.generatedSummary.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        periodType: 'DAILY',
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-10-02'),
        sourceUpdateCount: 1,
        sourceSessionMinutes: 60,
        content: 'Summary text',
        status: 'COMPLETE',
      },
    });

    const reportKey = `${adminA.user.companyId}/${randomUUID()}.pdf`;
    await storage.put(reportKey, Buffer.from('%PDF-1.4 test'));
    await prisma.report.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        requestedByUserId: adminA.user.id,
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-10-02'),
        status: 'READY',
        storageKey: reportKey,
        summaryId: summary.id,
      },
    });

    const exportKey = `${adminA.user.companyId}/${randomUUID()}.zip`;
    await storage.put(exportKey, Buffer.from('PK-zip-test'));
    await prisma.dataExport.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        requestedByUserId: adminA.user.id,
        status: 'READY',
        storageKey: exportKey,
      },
    });

    const delReq = await prisma.deletionRequest.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        reason: 'Please delete my data',
        status: 'OPEN',
      },
    });

    // 1. Wrong confirmName -> 400
    const wrongRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/erase`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ confirmName: 'Wrong Name' });
    expect(wrongRes.status).toBe(400);

    // 2. Right confirmName -> 202
    const eraseRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/erase`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ confirmName: empA.employee.name });
    expect(eraseRes.status).toBe(202);

    // Allow inline queue job to settle
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const emp = await prisma.employee.findUnique({ where: { id: empA.employee.id } });
      if (emp?.deletedAt) break;
    }

    // 3. Verify zero rows in related tables
    const sessions = await prisma.workSession.findMany({ where: { employeeId: empA.employee.id } });
    expect(sessions).toHaveLength(0);

    const points = await prisma.locationPoint.findMany({ where: { employeeId: empA.employee.id } });
    expect(points).toHaveLength(0);

    const updates = await prisma.workUpdate.findMany({ where: { employeeId: empA.employee.id } });
    expect(updates).toHaveLength(0);

    const summaries = await prisma.generatedSummary.findMany({ where: { employeeId: empA.employee.id } });
    expect(summaries).toHaveLength(0);

    const reportsRemain = await prisma.report.findMany({ where: { employeeId: empA.employee.id } });
    expect(reportsRemain).toHaveLength(0);

    const exportsRemain = await prisma.dataExport.findMany({ where: { employeeId: empA.employee.id } });
    expect(exportsRemain).toHaveLength(0);

    const consents = await prisma.consentRecord.findMany({ where: { employeeId: empA.employee.id } });
    expect(consents).toHaveLength(0);

    // 4. Verify storage files are gone
    let reportFileExists = true;
    try {
      await storage.stream(reportKey);
    } catch {
      reportFileExists = false;
    }
    expect(reportFileExists).toBe(false);

    let exportFileExists = true;
    try {
      await storage.stream(exportKey);
    } catch {
      exportFileExists = false;
    }
    expect(exportFileExists).toBe(false);

    // 5. Verify employee row is anonymised and hidden
    const anonymisedEmp = await prisma.employee.findUnique({ where: { id: empA.employee.id } });
    expect(anonymisedEmp?.name).toBe('Deleted employee');
    expect(anonymisedEmp?.email).toBeNull();
    expect(anonymisedEmp?.phone).toBeNull();
    expect(anonymisedEmp?.deletedAt).not.toBeNull();

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/employees/${empA.employee.id}`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminA.token}`);
    const foundInList = listRes.body.items.some((e: any) => e.id === empA.employee.id);
    expect(foundInList).toBe(false);

    // 6. Deletion request is marked DONE
    const updatedReq = await prisma.deletionRequest.findUnique({ where: { id: delReq.id } });
    expect(updatedReq?.status).toBe('DONE');

    // 7. Audit rows remain
    const eraseAudits = await prisma.auditLog.findMany({
      where: { companyId: adminA.user.companyId, action: 'employee.erased' },
    });
    expect(eraseAudits.length).toBeGreaterThanOrEqual(1);

    // 8. Another company admin -> 404
    const adminB = await signupAs(app);
    const eraseB = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/erase`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .send({ confirmName: 'Deleted employee' });
    expect(eraseB.status).toBe(404);
  });
});
