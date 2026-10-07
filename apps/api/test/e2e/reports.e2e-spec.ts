import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { AI_CLIENT } from '../../src/common/ai/ai-client.js';
import type { FakeAiClient } from '../../src/common/ai/fake.ai-client.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { fakePdfRendererInstance } from '../../src/modules/reports/reports.module.js';
import { SummarySweeperService } from '../../src/modules/summaries/services/summary-sweeper.service.js';
import { employeeAs, signupAs } from '../helpers/auth.js';
import { makeEmployee, resetDb } from '../helpers/db.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

const until = async (fn: () => Promise<boolean>) => {
  for (let i = 0; i < 50; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out');
};

describe('PDF work reports (admin)', () => {
  let app: INestApplication;
  let ai: FakeAiClient;

  const get = (token: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const post = (token: string, path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${token}`).send(body);

  async function seeded() {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid, { name: 'Amit Kumar', designation: 'Field Sales', phone: '+919800000110' });
    const d5 = dayBounds('2026-10-05', TZ);
    const day = await prisma.workSession.create({
      data: {
        companyId: cid,
        employeeId: emp.id,
        status: 'COMPLETED',
        startedAtServer: new Date(d5.start.getTime() + 3 * 3600_000),
        endedAtServer: new Date(d5.start.getTime() + 5 * 3600_000),
        totalMinutes: 120,
      },
    });
    await prisma.locationPoint.createMany({
      data: [0, 30, 60].map((m) => ({
        companyId: cid,
        employeeId: emp.id,
        sessionId: day.id,
        clientPointId: randomUUID(),
        latitude: 19.0 + m / 1000,
        longitude: 72.8,
        source: 'BACKGROUND' as const,
        capturedAt: new Date(day.startedAtServer.getTime() + m * 60_000),
      })),
    });
    for (let i = 0; i < 3; i++) {
      await prisma.workUpdate.create({
        data: {
          companyId: cid,
          employeeId: emp.id,
          sessionId: day.id,
          clientUpdateId: randomUUID(),
          text: `Update number ${i}`,
          inputMethod: i === 0 ? 'VOICE' : 'TYPED',
          category: i === 0 ? 'SITE_VISIT' : null,
          submittedAt: new Date(day.startedAtServer.getTime() + (i + 1) * 10 * 60_000),
          summaryStatus: 'COMPLETE',
          aiSummary: `Summary for update ${i}`,
          aiStructuredData: {
            summary: `Summary for update ${i}`,
            activities: ['Site inspection'],
            issues: [],
            followUps: [],
            confidence: 'HIGH',
          },
        },
      });
    }
    return { admin, emp, day };
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    ai = app.get(AI_CLIENT);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    ai.reset();
    fakePdfRendererInstance.reset();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a report (202 QUEUED), generates PDF, and serves GET /reports/:id as READY', async () => {
    const { admin, emp } = await seeded();
    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);

    expect(res.body.report).toMatchObject({
      status: 'QUEUED',
      employeeName: 'Amit Kumar',
      requestedBy: admin.user.name,
    });
    const id = res.body.report.id as string;

    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'READY');

    const detail = await get(admin.token, `/reports/${id}`).expect(200);
    expect(detail.body).toMatchObject({
      id,
      status: 'READY',
      employeeName: 'Amit Kumar',
      requestedBy: admin.user.name,
    });
    expect(detail.body.byteSize).toBeGreaterThan(0);
    expect(detail.body.expiresAt).not.toBeNull();
    const expires = new Date(detail.body.expiresAt);
    const in25Days = new Date(Date.now() + 25 * 24 * 3600_000);
    expect(expires.getTime()).toBeGreaterThan(in25Days.getTime());
  });

  it('downloads the PDF with correct headers and audits the download', async () => {
    const { admin, emp } = await seeded();
    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);

    const id = res.body.report.id as string;
    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'READY');

    const dl = await request(app.getHttpServer())
      .get(`/api/v1/reports/${id}/download`)
      .set('Authorization', `Bearer ${admin.token}`)
      .responseType('blob')
      .expect(200);

    expect(dl.headers['content-type']).toBe('application/pdf');
    expect(dl.headers['content-disposition']).toBe(
      'attachment; filename="work-report-amit-kumar-2026-10-05-to-2026-10-05.pdf"',
    );
    expect(dl.headers['cache-control']).toBe('private, no-store');
    expect(dl.body.slice(0, 4).toString()).toBe('%PDF');

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: admin.user.companyId,
        action: 'report.downloaded',
        entityId: id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('download while QUEUED returns 409 REPORT_NOT_READY', async () => {
    const { admin, emp } = await seeded();
    const report = await prisma.report.create({
      data: {
        companyId: admin.user.companyId,
        employeeId: emp.id,
        requestedByUserId: admin.user.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        status: 'QUEUED',
      },
    });

    const res = await get(admin.token, `/reports/${report.id}/download`).expect(409);
    expect(res.body.error.code).toBe('REPORT_NOT_READY');
  });

  it('expired report returns 410 REPORT_EXPIRED, and sweeper removes the file', async () => {
    const { admin, emp } = await seeded();
    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);
    const id = res.body.report.id as string;
    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'READY');

    const readyReport = await prisma.report.findUniqueOrThrow({ where: { id } });
    expect(readyReport.storageKey).not.toBeNull();

    // Expire it
    await prisma.report.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 10_000) },
    });

    const dl = await get(admin.token, `/reports/${id}/download`).expect(410);
    expect(dl.body.error.code).toBe('REPORT_EXPIRED');

    // Run sweeper
    await app.get(SummarySweeperService).sweep();

    const afterSweep = await prisma.report.findUniqueOrThrow({ where: { id } });
    expect(afterSweep.status).toBe('READY');
    expect(afterSweep.storageKey).toBeNull();
  });

  it('failed AI summary does not fail the report; HTML contains "Summary unavailable"', async () => {
    const { admin, emp } = await seeded();
    ai.script({ kind: 'invalid', text: 'nope' }, { kind: 'invalid', text: 'still nope' });

    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);
    const id = res.body.report.id as string;
    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'READY');

    expect(fakePdfRendererInstance.lastHtml).toContain('Summary unavailable');
  });

  it('marks report FAILED when the PDF renderer throws', async () => {
    const { admin, emp } = await seeded();
    fakePdfRendererInstance.shouldFail = true;

    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);
    const id = res.body.report.id as string;

    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'FAILED');

    const detail = await get(admin.token, `/reports/${id}`).expect(200);
    expect(detail.body.status).toBe('FAILED');
    expect(detail.body.failureReason).toBe('RENDER_FAILED');
  });

  it('another company admin gets 404 on GET, download, and POST with employee', async () => {
    const { admin, emp } = await seeded();
    const otherAdmin = await signupAs(app);

    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(202);
    const id = res.body.report.id as string;
    await until(async () => (await prisma.report.findUniqueOrThrow({ where: { id } })).status === 'READY');

    await get(otherAdmin.token, `/reports/${id}`).expect(404);
    await get(otherAdmin.token, `/reports/${id}/download`).expect(404);
    await post(otherAdmin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(404);
  });

  it('employee token on POST /reports returns 403', async () => {
    const { admin } = await seeded();
    const empUser = await employeeAs(app, prisma, admin.user.companyId);

    await post(empUser.token, '/reports', {
      employeeId: empUser.employee.id,
      from: '2026-10-05',
      to: '2026-10-05',
    }).expect(403);
  });

  it('GET /reports?employeeId= lists only this company reports, paged and newest first', async () => {
    const { admin, emp } = await seeded();
    const emp2 = await makeEmployee(prisma, admin.user.companyId, { name: 'Pooja Sharma' });

    const r1 = await post(admin.token, '/reports', { employeeId: emp.id, from: '2026-10-05', to: '2026-10-05' }).expect(202);
    const r2 = await post(admin.token, '/reports', { employeeId: emp2.id, from: '2026-10-05', to: '2026-10-05' }).expect(202);

    const listAll = await get(admin.token, '/reports').expect(200);
    expect(listAll.body.total).toBe(2);
    expect(listAll.body.items[0].id).toBe(r2.body.report.id);
    expect(listAll.body.items[1].id).toBe(r1.body.report.id);

    const listEmp1 = await get(admin.token, `/reports?employeeId=${emp.id}`).expect(200);
    expect(listEmp1.body.total).toBe(1);
    expect(listEmp1.body.items[0].employeeId).toBe(emp.id);
  });

  it('rejects a range longer than 31 days with 400', async () => {
    const { admin, emp } = await seeded();
    const res = await post(admin.token, '/reports', {
      employeeId: emp.id,
      from: '2026-09-01',
      to: '2026-10-15',
    }).expect(400);

    expect(JSON.stringify(res.body)).toContain('31');
  });
});
