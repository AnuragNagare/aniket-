import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { AI_CLIENT } from '../../src/common/ai/ai-client.js';
import type { FakeAiClient } from '../../src/common/ai/fake.ai-client.js';
import { UpdateSummaryService } from '../../src/modules/summaries/services/update-summary.service.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const until = async (fn: () => Promise<boolean>) => {
  for (let i = 0; i < 50; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out');
};

describe('per-update AI summaries', () => {
  let app: INestApplication;
  let ai: FakeAiClient;

  async function sendUpdate(text = 'Completed installation at Sai Kripa Clinic. One sensor needs replacement.') {
    const admin = await signupAs(app);
    const e = await employeeAs(app, prisma, admin.user.companyId);
    const s = await request(app.getHttpServer()).post('/api/v1/sessions/start').set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(201);
    await prisma.workSession.update({ where: { id: s.body.session.id }, data: { startedAtServer: new Date(Date.now() - 60 * 60_000) } });
    const sessionId = s.body.session.id as string;
    const res = await request(app.getHttpServer()).post('/api/v1/updates').set('Authorization', `Bearer ${e.token}`)
      .send({ clientUpdateId: randomUUID(), sessionId, text, inputMethod: 'VOICE', category: 'INSTALLATION', submittedAt: new Date().toISOString() })
      .expect(201);
    return { admin, e: { ...e, sessionId }, id: res.body.update.id as string, res };
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

  it('returns QUEUED at once, then stores a COMPLETE summary with the model name', async () => {
    ai.script({ kind: 'ok', data: { summary: 'Installation done; one sensor to replace.', activities: ['Installation'], issues: ['Faulty sensor'], followUps: ['Replace sensor'], confidence: 'HIGH' } });
    const { id, res } = await sendUpdate();
    expect(res.body.update).toMatchObject({ summaryStatus: 'QUEUED', aiSummary: null });
    await until(async () => (await prisma.workUpdate.findUniqueOrThrow({ where: { id } })).summaryStatus === 'COMPLETE');
    const row = await prisma.workUpdate.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ aiSummary: 'Installation done; one sensor to replace.', modelName: 'claude-opus-5-5', text: expect.stringContaining('Sai Kripa') });
    expect(row.aiStructuredData).toMatchObject({ followUps: ['Replace sensor'], confidence: 'HIGH' });
    expect(ai.calls[0]!.user).not.toMatch(/Amit|@|latitude/);
  });

  it('marks FAILED after a bad answer and a failed repair, keeping the raw text', async () => {
    ai.script({ kind: 'invalid', text: 'x' }, { kind: 'invalid', text: 'y' });
    const { id } = await sendUpdate();
    await until(async () => (await prisma.workUpdate.findUniqueOrThrow({ where: { id } })).summaryStatus === 'FAILED');
    expect(await prisma.workUpdate.findUniqueOrThrow({ where: { id } })).toMatchObject({ aiSummary: null, summaryError: 'INVALID_OUTPUT' });
  });

  it('running the job twice calls the AI once', async () => {
    const { id } = await sendUpdate();
    await until(async () => (await prisma.workUpdate.findUniqueOrThrow({ where: { id } })).summaryStatus === 'COMPLETE');
    await app.get(UpdateSummaryService).process(id);
    expect(ai.calls).toHaveLength(1);
  });

  it('the employee sees the summary in their history and the admin in the employee updates', async () => {
    const { admin, e, id } = await sendUpdate();
    await until(async () => (await prisma.workUpdate.findUniqueOrThrow({ where: { id } })).summaryStatus === 'COMPLETE');
    const today = new Date().toISOString().slice(0, 10);
    const mine = await request(app.getHttpServer()).get(`/api/v1/me/history?from=${today}&to=${today}`).set('Authorization', `Bearer ${e.token}`).expect(200);
    expect(mine.body.updates[0].aiSummary).toMatchObject({ summary: expect.any(String) });
    const theirs = await request(app.getHttpServer()).get(`/api/v1/employees/${e.employee.id}/updates?from=${today}&to=${today}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(theirs.body.items[0].aiSummary).not.toBeNull();
  });
});
