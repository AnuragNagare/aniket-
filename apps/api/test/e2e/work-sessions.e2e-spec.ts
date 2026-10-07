import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

describe('work sessions (admin)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function forgotten() {
    const admin = await signupAs(app);
    const e = await employeeAs(app, prisma, admin.user.companyId);
    const s = await prisma.workSession.create({
      data: { companyId: admin.user.companyId, employeeId: e.employee.id, startedAtServer: hoursAgo(30) },
    });
    return { admin, e, s };
  }
  const close = (token: string, employeeId: string, sessionId: string, endedAt: string) =>
    http().post(`/api/v1/employees/${employeeId}/sessions/${sessionId}/close`).set('Authorization', `Bearer ${token}`).send({ endedAt });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('closes a forgotten session at the chosen time, marks it INCOMPLETE and audits it', async () => {
    const { admin, e, s } = await forgotten();
    const endedAt = hoursAgo(22).toISOString();
    const res = await close(admin.token, e.employee.id, s.id, endedAt).expect(200);
    expect(res.body).toMatchObject({ status: 'INCOMPLETE', endedAt, totalMinutes: 480, leftRunning: false });
    expect(await prisma.auditLog.count({ where: { action: 'session.closed_by_admin', entityId: s.id, actorUserId: admin.user.id } })).toBe(1);
    // The employee's phone learns on its next sync that nothing is running.
    const active = await http().get('/api/v1/sessions/me/active').set('Authorization', `Bearer ${e.token}`).expect(200);
    expect(active.body.session).toBeNull();
  });

  it('points captured after the admin’s end time are refused by the window check', async () => {
    const { admin, e, s } = await forgotten();
    await close(admin.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(200);
    const res = await http()
      .post('/api/v1/locations/batch')
      .set('Authorization', `Bearer ${e.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        sessionId: s.id,
        points: [{ clientPointId: randomUUID(), latitude: 19, longitude: 72.8, capturedAt: hoursAgo(1).toISOString() }],
      })
      .expect(200);
    expect(res.body.rejected).toHaveLength(1);
  });

  it('refuses an end time before the start or in the future, and a second close', async () => {
    const { admin, e, s } = await forgotten();
    const bad = await close(admin.token, e.employee.id, s.id, hoursAgo(40).toISOString()).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'INVALID_END_TIME', message: 'Choose an end time between the start of the session and now.' });
    await close(admin.token, e.employee.id, s.id, new Date(Date.now() + 3600_000).toISOString()).expect(400);
    await close(admin.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(200);
    const again = await close(admin.token, e.employee.id, s.id, hoursAgo(21).toISOString()).expect(409);
    expect(again.body.error.code).toBe('SESSION_NOT_ACTIVE');
  });

  it("cannot close another company's session", async () => {
    const { e, s } = await forgotten();
    const other = await signupAs(app);
    await close(other.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(404);
    expect((await prisma.workSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('ACTIVE');
  });

  it('lists company sessions with labels and filters', async () => {
    const { admin, e } = await forgotten();
    await prisma.workSession.create({
      data: { companyId: admin.user.companyId, employeeId: e.employee.id, status: 'COMPLETED', startedAtServer: hoursAgo(5), endedAtServer: hoursAgo(1), totalMinutes: 240 },
    });
    const all = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toMatchObject({ employeeName: expect.any(String), status: 'COMPLETED', pointCount: 0 });
    const stuck = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}&status=LEFT_RUNNING`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(stuck.body.items).toEqual([expect.objectContaining({ leftRunning: true })]);
    const other = await signupAs(app);
    const none = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}`).set('Authorization', `Bearer ${other.token}`).expect(200);
    expect(none.body.total).toBe(0);
  });
});
