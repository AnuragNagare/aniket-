import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';

describe('Data exports (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('generates a ZIP data export with sessions, locations, updates, and neutralized CSV injection', async () => {
    const adminA = await signupAs(app);
    const empA = await employeeAs(app, prisma, adminA.user.companyId);

    // Seed session, points, updates
    const session = await prisma.workSession.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        startedAtServer: new Date('2026-10-01T09:00:00.000Z'),
        endedAtServer: new Date('2026-10-01T17:00:00.000Z'),
        status: 'COMPLETED',
        totalMinutes: 480,
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
        accuracyMeters: 8,
        source: 'START',
        capturedAt: new Date('2026-10-01T09:00:00.000Z'),
      },
    });

    // Update with potential CSV injection formula
    await prisma.workUpdate.create({
      data: {
        companyId: adminA.user.companyId,
        employeeId: empA.employee.id,
        sessionId: session.id,
        clientUpdateId: randomUUID(),
        text: '=SUM(1,2)',
        inputMethod: 'TYPED',
        category: 'site_visit',
        submittedAt: new Date('2026-10-01T11:00:00.000Z'),
      },
    });

    // 1. Request export -> 202
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/exports`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(postRes.status).toBe(202);
    const exportId = postRes.body.id;
    expect(exportId).toBeDefined();

    // 2. Poll until READY (in inline mode it completes promptly)
    let exportRow;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      exportRow = await prisma.dataExport.findUnique({ where: { id: exportId } });
      if (exportRow?.status === 'READY') break;
    }
    expect(exportRow?.status).toBe('READY');
    expect(exportRow?.byteSize).toBeGreaterThan(0);

    // 3. Download export -> application/zip
    const dlRes = await request(app.getHttpServer())
      .get(`/api/v1/exports/${exportId}/download`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .responseType('blob');
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers['content-type']).toBe('application/zip');
    expect(dlRes.headers['content-disposition']).toContain(`worktrail-export-${exportId}.zip`);

    // Verify ZIP structure and entries
    const zip = new AdmZip(dlRes.body);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('sessions.csv');
    expect(entries).toContain('locations.csv');
    expect(entries).toContain('updates.csv');
    expect(entries).toContain('README.txt');

    // Verify CSV injection neutralized in updates.csv
    const updatesCsv = zip.readAsText('updates.csv');
    expect(updatesCsv).toContain('submitted_at,text,category,input_method');
    expect(updatesCsv).toContain("'=SUM(1,2)");

    // Verify sessions.csv content
    const sessionsCsv = zip.readAsText('sessions.csv');
    expect(sessionsCsv).toContain('id,started_at,ended_at,status,total_minutes');
    expect(sessionsCsv).toContain(session.id);
    expect(sessionsCsv).toContain('COMPLETED');

    // Verify locations.csv content
    const locationsCsv = zip.readAsText('locations.csv');
    expect(locationsCsv).toContain('captured_at,latitude,longitude,accuracy,source,battery');
    expect(locationsCsv).toContain('12.9716');

    // 4. Verify audit rows
    const reqAudit = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'export.requested', entityId: exportId },
    });
    expect(reqAudit).not.toBeNull();

    const dlAudit = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'export.downloaded', entityId: exportId },
    });
    expect(dlAudit).not.toBeNull();

    // 5. Expired export -> 410
    await prisma.dataExport.update({
      where: { id: exportId },
      data: { expiresAt: new Date(Date.now() - 3600000) },
    });
    const expRes = await request(app.getHttpServer())
      .get(`/api/v1/exports/${exportId}/download`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(expRes.status).toBe(410);

    // 6. Another company -> 404
    const adminB = await signupAs(app);
    const getB = await request(app.getHttpServer())
      .get(`/api/v1/exports/${exportId}`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(getB.status).toBe(404);

    const dlB = await request(app.getHttpServer())
      .get(`/api/v1/exports/${exportId}/download`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(dlB.status).toBe(404);
  });
});
