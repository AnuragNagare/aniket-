import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { AI_CLIENT } from '../../src/common/ai/ai-client.js';
import type { FakeAiClient } from '../../src/common/ai/fake.ai-client.js';
import { dayBounds } from '../../src/common/utils/time.js';
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

describe('period AI summaries (admin)', () => {
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
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('generates, caches and refreshes a period report with correct metrics and prompt', async () => {
    const { admin, emp } = await seeded();
    const emptyRes = await get(admin.token, `/employees/${emp.id}/summaries?from=2026-10-05&to=2026-10-05`).expect(200);
    expect(emptyRes.body).toBeNull();

    const postRes = await post(admin.token, `/employees/${emp.id}/summaries`, { from: '2026-10-05', to: '2026-10-05' }).expect(202);
    expect(postRes.body).toMatchObject({ periodType: 'DAILY', sourceUpdateCount: 3 });

    await until(async () => {
      const row = await prisma.generatedSummary.findUnique({ where: { id: postRes.body.id } });
      return row?.status === 'COMPLETE';
    });

    const getRes = await get(admin.token, `/employees/${emp.id}/summaries?from=2026-10-05&to=2026-10-05`).expect(200);
    expect(getRes.body).toMatchObject({
      status: 'COMPLETE',
      modelName: 'claude-opus-5-5',
      report: expect.objectContaining({ overview: expect.any(String) }),
    });

    const lastCall = ai.calls.at(-1)!;
    const payload = JSON.parse(lastCall.user);
    expect(Object.keys(payload).sort()).toEqual(['employeeName', 'periodLabel', 'updates', 'workSessionMetrics']);
    expect(payload.workSessionMetrics.sessionCount).toBe(1);
    expect(payload.updates).toHaveLength(3);

    // Second post without refresh returns cached
    const callsBefore = ai.calls.length;
    const cachedPost = await post(admin.token, `/employees/${emp.id}/summaries`, { from: '2026-10-05', to: '2026-10-05' }).expect(202);
    expect(cachedPost.body.id).toBe(postRes.body.id);
    expect(ai.calls.length).toBe(callsBefore);

    // With refresh=1 calls AI again
    const refreshedPost = await post(admin.token, `/employees/${emp.id}/summaries?refresh=1`, { from: '2026-10-05', to: '2026-10-05' }).expect(202);
    expect(refreshedPost.body.id).toBe(postRes.body.id);
    await until(async () => ai.calls.length > callsBefore);

    // Audit record exists
    const audit = await prisma.auditLog.findFirst({ where: { action: 'summary.requested', entityId: postRes.body.id } });
    expect(audit).not.toBeNull();
  });

  it('handles empty periods with Not enough information provided', async () => {
    const { admin, emp } = await seeded();
    ai.script({
      kind: 'ok',
      data: {
        overview: 'Not enough information provided.',
        keyActivities: [],
        reportedIssues: [],
        reportedFollowUps: [],
        dataNotes: [],
      },
    });

    const res = await post(admin.token, `/employees/${emp.id}/summaries`, { from: '2026-10-01', to: '2026-10-01' }).expect(202);
    await until(async () => (await prisma.generatedSummary.findUnique({ where: { id: res.body.id } }))?.status === 'COMPLETE');
    const row = await prisma.generatedSummary.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.content).toBe('Not enough information provided.');
  });

  it('notes a session left running in the period', async () => {
    const { admin, emp } = await seeded();
    await prisma.workSession.create({
      data: {
        companyId: admin.user.companyId,
        employeeId: emp.id,
        status: 'ACTIVE',
        startedAtServer: new Date(Date.now() - 20 * 3600_000),
      },
    });
    const today = new Date().toISOString().slice(0, 10);
    const res = await post(admin.token, `/employees/${emp.id}/summaries`, { from: today, to: today }).expect(202);
    await until(async () => (await prisma.generatedSummary.findUnique({ where: { id: res.body.id } }))?.status === 'COMPLETE');
    const finalGet = await get(admin.token, `/employees/${emp.id}/summaries?from=${today}&to=${today}`).expect(200);
    expect(finalGet.body.report.dataNotes).toContain('A work session was still open at the time of the report.');
  });

  it('drops update text when over 150 updates and appends shortened data note', async () => {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid, { name: 'Pooja V', designation: 'Delivery' });
    const d5 = dayBounds('2026-10-05', TZ);
    const session = await prisma.workSession.create({
      data: {
        companyId: cid,
        employeeId: emp.id,
        status: 'COMPLETED',
        startedAtServer: new Date(d5.start.getTime() + 3600_000),
        endedAtServer: new Date(d5.start.getTime() + 8 * 3600_000),
        totalMinutes: 420,
      },
    });
    const updateRows = Array.from({ length: 160 }, (_, i) => ({
      companyId: cid,
      employeeId: emp.id,
      sessionId: session.id,
      clientUpdateId: randomUUID(),
      text: `Delivery update number ${i}`,
      aiSummary: `Delivered item ${i}`,
      summaryStatus: 'COMPLETE' as const,
      inputMethod: 'TYPED' as const,
      submittedAt: new Date(session.startedAtServer.getTime() + i * 60_000),
    }));
    await prisma.workUpdate.createMany({ data: updateRows });

    const res = await post(admin.token, `/employees/${emp.id}/summaries`, { from: '2026-10-05', to: '2026-10-05' }).expect(202);
    await until(async () => (await prisma.generatedSummary.findUnique({ where: { id: res.body.id } }))?.status === 'COMPLETE');

    const lastCall = ai.calls.at(-1)!;
    const payload = JSON.parse(lastCall.user);
    expect(payload.updates[0].text).toBeUndefined();
    expect(payload.updates[0].summary).toBeDefined();

    const finalGet = await get(admin.token, `/employees/${emp.id}/summaries?from=2026-10-05&to=2026-10-05`).expect(200);
    expect(finalGet.body.report.dataNotes).toContain('Some update text was shortened to fit; per-update summaries were used.');
  });

  it('enforces multi-tenant isolation and role checks', async () => {
    const { emp } = await seeded();
    const otherAdmin = await signupAs(app);
    await get(otherAdmin.token, `/employees/${emp.id}/summaries?from=2026-10-05&to=2026-10-05`).expect(404);
    await post(otherAdmin.token, `/employees/${emp.id}/summaries`, { from: '2026-10-05', to: '2026-10-05' }).expect(404);

    const empUser = await employeeAs(app, prisma);
    await post(empUser.token, `/employees/${emp.id}/summaries`, { from: '2026-10-05', to: '2026-10-05' }).expect(403);
  });

  it('sweeper picks up stuck QUEUED update jobs', async () => {
    const { admin, emp, day } = await seeded();
    const stuck = await prisma.workUpdate.create({
      data: {
        companyId: admin.user.companyId,
        employeeId: emp.id,
        sessionId: day.id,
        clientUpdateId: randomUUID(),
        text: 'Stuck update waiting for summary',
        inputMethod: 'TYPED',
        summaryStatus: 'QUEUED',
        submittedAt: new Date(Date.now() - 5 * 60_000),
      },
    });

    await app.get(SummarySweeperService).sweep();
    await until(async () => (await prisma.workUpdate.findUniqueOrThrow({ where: { id: stuck.id } })).summaryStatus === 'COMPLETE');
  });
});
