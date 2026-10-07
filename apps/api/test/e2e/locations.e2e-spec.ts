import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const pt = (capturedAt: string, over: Record<string, unknown> = {}) => ({
  clientPointId: randomUUID(),
  latitude: 19.07,
  longitude: 72.87,
  accuracyMeters: 25,
  capturedAt,
  ...over,
});

describe('POST /locations/batch', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const batch = (token: string, body: object, key: string | null = randomUUID()) => {
    const r = http().post('/api/v1/locations/batch').set('Authorization', `Bearer ${token}`);
    return (key ? r.set('Idempotency-Key', key) : r).send(body);
  };
  async function working() {
    const e = await employeeAs(app, prisma);
    const s = await http()
      .post('/api/v1/sessions/start')
      .set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() })
      .expect(201);
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

  it('stores background points with source and quality, and reports the last time', async () => {
    const e = await working();
    const res = await batch(e.token, {
      sessionId: e.sessionId,
      points: [pt(minutesAgo(10), { speedMps: 1.4, bearing: 180 }), pt(minutesAgo(5), { accuracyMeters: 300 })],
    }).expect(200);
    expect(res.body).toEqual({ accepted: 2, duplicates: 0, rejected: [], lastLocationAt: expect.any(String) });
    const rows = await prisma.locationPoint.findMany({ orderBy: { capturedAt: 'asc' } });
    expect(rows.map((r) => [r.source, r.qualityFlag])).toEqual([['BACKGROUND', 'GOOD'], ['BACKGROUND', 'LOW_ACCURACY']]);
    expect(Number(rows[0]!.speedMps)).toBe(1.4);
  });

  it('a retried batch is counted as duplicates, never stored twice', async () => {
    const e = await working();
    const body = { sessionId: e.sessionId, points: [pt(minutesAgo(10)), pt(minutesAgo(5))] };
    await batch(e.token, body).expect(200);
    const again = await batch(e.token, body).expect(200);
    expect(again.body).toMatchObject({ accepted: 0, duplicates: 2 });
    expect(await prisma.locationPoint.count()).toBe(2);
  });

  it('accepts points captured during the session even after End work (offline upload)', async () => {
    const e = await working();
    const during = pt(minutesAgo(20));
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    const res = await batch(e.token, { sessionId: e.sessionId, points: [during] }).expect(200);
    expect(res.body.accepted).toBe(1);
  });

  it('rejects points captured outside the session window, without failing the rest', async () => {
    const e = await working();
    const before = pt(minutesAgo(180));
    const good = pt(minutesAgo(30));
    const res = await batch(e.token, { sessionId: e.sessionId, points: [before, good] }).expect(200);
    expect(res.body).toMatchObject({ accepted: 1, rejected: [{ clientPointId: before.clientPointId, reason: 'OUTSIDE_SESSION' }] });
  });

  it('requires an Idempotency-Key header', async () => {
    const e = await working();
    const res = await batch(e.token, { sessionId: e.sessionId, points: [pt(minutesAgo(1))] }, null).expect(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it("returns 404 for another employee's session, same company or not", async () => {
    const a = await working();
    const colleague = await employeeAs(app, prisma, a.user.companyId);
    const outsider = await employeeAs(app, prisma);
    await batch(colleague.token, { sessionId: a.sessionId, points: [pt(minutesAgo(1))] }).expect(404);
    await batch(outsider.token, { sessionId: a.sessionId, points: [pt(minutesAgo(1))] }).expect(404);
    expect(await prisma.locationPoint.count()).toBe(0);
  });

  it('admins cannot upload points', async () => {
    const admin = await signupAs(app);
    await batch(admin.token, { sessionId: randomUUID(), points: [pt(minutesAgo(1))] }).expect(403);
  });

  it('validates the batch with field messages', async () => {
    const e = await working();
    const res = await batch(e.token, { sessionId: e.sessionId, points: [] }).expect(400);
    expect(res.body.error.details.fields.points).toBe('Send at least one point.');
  });
});
