import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('ending work that was ended offline', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function sessionStarted(minutesAgo: number) {
    const e = await employeeAs(app, prisma);
    const s = await http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(201);
    await prisma.workSession.update({
      where: { id: s.body.session.id },
      data: { startedAtServer: new Date(Date.now() - minutesAgo * 60_000) },
    });
    return { token: e.token, id: s.body.session.id as string };
  }
  const end = (token: string, id: string, endedAt: string) =>
    http().post(`/api/v1/sessions/${id}/end`).set('Authorization', `Bearer ${token}`)
      .send({ deviceTime: endedAt, endedAt });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('uses the tap time, not the time the request finally arrived', async () => {
    const s = await sessionStarted(120);
    const tappedAt = new Date(Date.now() - 45 * 60_000).toISOString(); // ended 45 min ago, synced now
    const res = await end(s.token, s.id, tappedAt).expect(200);
    expect(res.body.session.totalMinutes).toBe(75);
    expect(res.body.session.endedAt).toBe(tappedAt);
  });

  it('never ends before the start', async () => {
    const s = await sessionStarted(30);
    const res = await end(s.token, s.id, new Date(Date.now() - 5 * 3600_000).toISOString()).expect(200);
    expect(res.body.session.totalMinutes).toBe(0);
  });

  it('never ends in the future', async () => {
    const s = await sessionStarted(30);
    const res = await end(s.token, s.id, new Date(Date.now() + 3600_000).toISOString()).expect(200);
    expect(res.body.session.totalMinutes).toBe(30);
  });
});
