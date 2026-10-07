import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { employeeAs, signupAs } from '../helpers/auth.js';
import { resetDb } from '../helpers/db.js';

const prisma = new PrismaClient();
const fix = (over: Record<string, unknown> = {}) => ({
  clientPointId: randomUUID(),
  latitude: 19.076,
  longitude: 72.8777,
  accuracyMeters: 18,
  capturedAt: new Date().toISOString(),
  batteryLevel: 0.7,
  ...over,
});

describe('work sessions', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const start = (
    token: string,
    body: object = { deviceTime: new Date().toISOString(), initialLocation: fix() },
  ) => http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${token}`).send(body);
  const end = (
    token: string,
    id: string,
    body: object = { deviceTime: new Date().toISOString(), finalLocation: fix() },
  ) => http().post(`/api/v1/sessions/${id}/end`).set('Authorization', `Bearer ${token}`).send(body);
  const active = (token: string) =>
    http().get('/api/v1/sessions/me/active').set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('start creates one ACTIVE session with a START point and returns server time', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token).expect(201);
    expect(res.body.session).toMatchObject({ status: 'ACTIVE', endedAt: null, totalMinutes: null });
    expect(res.body.session.lastLocationAt).toEqual(expect.any(String));
    expect(Date.parse(res.body.serverTime)).toBeGreaterThan(Date.now() - 10_000);
    const points = await prisma.locationPoint.findMany({
      where: { sessionId: res.body.session.id },
    });
    expect(points).toEqual([expect.objectContaining({ source: 'START', qualityFlag: 'GOOD' })]);
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: res.body.session.id } });
    expect(row.startedAtDevice).not.toBeNull();
  });

  it('a second start returns the running session instead of creating another', async () => {
    const e = await employeeAs(app, prisma);
    const first = await start(e.token).expect(201);
    const second = await start(e.token).expect(409);
    expect(second.body.error.code).toBe('SESSION_ALREADY_ACTIVE');
    expect(second.body.error.details.session.id).toBe(first.body.session.id);
    expect(await prisma.workSession.count()).toBe(1);
  });

  it('two simultaneous starts create exactly one session', async () => {
    const e = await employeeAs(app, prisma);
    const [a, b] = await Promise.all([start(e.token), start(e.token)]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
    expect(await prisma.workSession.count()).toBe(1);
  });

  it('a retried start with the same point does not duplicate the point', async () => {
    const e = await employeeAs(app, prisma);
    const body = { deviceTime: new Date().toISOString(), initialLocation: fix() };
    await start(e.token, body).expect(201);
    await start(e.token, body).expect(409);
    expect(await prisma.locationPoint.count()).toBe(1);
  });

  it('starts without a location when the phone could not get a fix', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token, { deviceTime: new Date().toISOString() }).expect(201);
    expect(res.body.session.lastLocationAt).toBeNull();
  });

  it('flags poor or impossible-time fixes instead of dropping them', async () => {
    const e = await employeeAs(app, prisma);
    await start(e.token, {
      deviceTime: new Date().toISOString(),
      initialLocation: fix({ accuracyMeters: 250 }),
    }).expect(201);
    const p = await prisma.locationPoint.findFirstOrThrow();
    expect(p.qualityFlag).toBe('LOW_ACCURACY');
  });

  it('rejects impossible coordinates with a field message', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token, {
      deviceTime: new Date().toISOString(),
      initialLocation: fix({ latitude: 95 }),
    }).expect(400);
    expect(res.body.error.details.fields['initialLocation.latitude']).toBe(
      'Latitude must be between -90 and 90.',
    );
  });

  it('active is null when off duty and the session when working', async () => {
    const e = await employeeAs(app, prisma);
    expect((await active(e.token).expect(200)).body.session).toBeNull();
    const s = await start(e.token).expect(201);
    expect((await active(e.token).expect(200)).body.session.id).toBe(s.body.session.id);
  });

  it('end uses server time for the duration and stores an END point', async () => {
    const e = await employeeAs(app, prisma);
    const s = await start(e.token).expect(201);
    await prisma.workSession.update({
      where: { id: s.body.session.id },
      data: { startedAtServer: new Date(Date.now() - 90 * 60_000) },
    });
    // Phone clock is 3 hours wrong; the duration must not care.
    const res = await end(e.token, s.body.session.id, {
      deviceTime: new Date(Date.now() + 3 * 3600_000).toISOString(),
      finalLocation: fix(),
    }).expect(200);
    expect(res.body.session).toMatchObject({ status: 'COMPLETED', totalMinutes: 90 });
    const sources = (
      await prisma.locationPoint.findMany({ orderBy: { capturedAt: 'asc' } })
    ).map((p) => p.source);
    expect(sources).toEqual(['START', 'END']);
    expect((await active(e.token)).body.session).toBeNull();
  });

  it('ending twice is a clear 409, and a new start works afterwards', async () => {
    const e = await employeeAs(app, prisma);
    const s = await start(e.token).expect(201);
    await end(e.token, s.body.session.id).expect(200);
    const again = await end(e.token, s.body.session.id).expect(409);
    expect(again.body.error.code).toBe('SESSION_NOT_ACTIVE');
    await start(e.token).expect(201);
  });

  it("cannot end someone else's session, in the same company or another", async () => {
    const a = await employeeAs(app, prisma);
    const sameCompany = await employeeAs(app, prisma, a.user.companyId);
    const otherCompany = await employeeAs(app, prisma);
    const s = await start(a.token).expect(201);
    await end(sameCompany.token, s.body.session.id).expect(404);
    await end(otherCompany.token, s.body.session.id).expect(404);
    await end(a.token, 'not-a-uuid').expect(404);
  });

  it('admins cannot start sessions', async () => {
    const admin = await signupAs(app);
    await start(admin.token).expect(403);
  });

  it('an EMPLOYEE login without an employee record gets a clear 403', async () => {
    const e = await employeeAs(app, prisma);
    await prisma.employee.update({ where: { id: e.employee.id }, data: { userId: null } });
    const res = await start(e.token).expect(403);
    expect(res.body.error.code).toBe('NOT_AN_EMPLOYEE');
  });
});
