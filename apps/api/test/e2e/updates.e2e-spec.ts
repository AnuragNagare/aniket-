import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('POST /updates', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const send = (token: string, body: object) =>
    http().post('/api/v1/updates').set('Authorization', `Bearer ${token}`).send(body);
  const update = (sessionId: string, over: Record<string, unknown> = {}) => ({
    clientUpdateId: randomUUID(),
    sessionId,
    text: 'Visited client site, completed installation. One sensor needs replacement.',
    inputMethod: 'VOICE',
    category: 'INSTALLATION',
    submittedAt: minutesAgo(1),
    ...over,
  });
  async function atWork() {
    const e = await employeeAs(app, prisma);
    const s = await http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(201);
    await prisma.workSession.update({ where: { id: s.body.session.id }, data: { startedAtServer: new Date(Date.now() - 60 * 60_000) } });
    return { ...e, sessionId: s.body.session.id as string };
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('stores the update as QUEUED for a later summary', async () => {
    const e = await atWork();
    const res = await send(e.token, update(e.sessionId)).expect(201);
    expect(res.body).toMatchObject({
      duplicate: false,
      update: { inputMethod: 'VOICE', category: 'INSTALLATION', summaryStatus: 'QUEUED', sessionId: e.sessionId },
    });
    const row = await prisma.workUpdate.findFirstOrThrow();
    expect(row.text).toBe('Visited client site, completed installation. One sensor needs replacement.');
    expect(row.employeeId).toBe(e.employee.id);
  });

  it('a repeated send stores one update and returns the original', async () => {
    const e = await atWork();
    const body = update(e.sessionId);
    const first = await send(e.token, body).expect(201);
    const again = await send(e.token, body).expect(200);
    expect(again.body).toEqual({ update: first.body.update, duplicate: true });
    expect(await prisma.workUpdate.count()).toBe(1);
  });

  it('accepts an update written during the session but delivered after End work', async () => {
    const e = await atWork();
    const writtenAt = minutesAgo(20);
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    const res = await send(e.token, update(e.sessionId, { submittedAt: writtenAt })).expect(201);
    expect(res.body.update.submittedAt).toBe(writtenAt);
  });

  it('refuses an update written outside the session', async () => {
    const e = await atWork();
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    await prisma.workSession.update({ where: { id: e.sessionId }, data: { endedAtServer: new Date(Date.now() - 30 * 60_000) } });
    const res = await send(e.token, update(e.sessionId, { submittedAt: minutesAgo(1) })).expect(409);
    expect(res.body.error).toMatchObject({ code: 'SESSION_NOT_ACTIVE', message: 'Start work before adding an update.' });
  });

  it('never stores a time in the future', async () => {
    const e = await atWork();
    const res = await send(e.token, update(e.sessionId, { submittedAt: new Date(Date.now() + 60_000).toISOString() })).expect(201);
    expect(Date.parse(res.body.update.submittedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("returns 404 for someone else's session", async () => {
    const a = await atWork();
    const colleague = await employeeAs(app, prisma, a.user.companyId);
    await send(colleague.token, update(a.sessionId)).expect(404);
  });

  it('enforces the 5–2,000 character rule', async () => {
    const e = await atWork();
    const short = await send(e.token, update(e.sessionId, { text: ' hi  ' })).expect(400);
    expect(short.body.error.details.fields.text).toBe('Write at least 5 characters.');
    await send(e.token, update(e.sessionId, { text: 'x'.repeat(2001) })).expect(400);
  });

  it('admins cannot post updates', async () => {
    const admin = await signupAs(app);
    await send(admin.token, update(randomUUID())).expect(403);
  });
});
