import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

describe('employee activity (admin)', () => {
  let app: INestApplication;
  const get = (token: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  async function seeded() {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid, { name: 'Amit Kumar', designation: 'Field Sales', phone: '+919800000110' });
    const d4 = dayBounds('2026-10-04', TZ);
    // 23:30–00:30 IST across 4→5 Oct, and a normal day on the 5th.
    const overnight = await prisma.workSession.create({
      data: {
        companyId: cid,
        employeeId: emp.id,
        status: 'COMPLETED',
        startedAtServer: new Date(d4.end.getTime() - 30 * 60_000),
        endedAtServer: new Date(d4.end.getTime() + 30 * 60_000),
        totalMinutes: 60,
      },
    });
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
    return { admin, emp, overnight, day };
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

  it('detail includes phone, joined date and last seen', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}`).expect(200);
    expect(res.body).toMatchObject({
      name: 'Amit Kumar',
      phone: '+919800000110',
      workingSince: null,
      lastSeenAt: expect.any(String),
      joinedAt: expect.any(String),
    });
  });

  it('sessions splits the overnight session across days and totals the period', async () => {
    const { admin, emp, overnight } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/sessions?from=2026-10-04&to=2026-10-05`).expect(200);
    expect(res.body.days).toEqual([
      { date: '2026-10-04', minutes: 30 },
      { date: '2026-10-05', minutes: 150 },
    ]);
    expect(res.body.totalMinutes).toBe(180);
    const o = res.body.sessions.find((s: { id: string }) => s.id === overnight.id);
    expect(o).toMatchObject({ pointCount: 0, leftRunning: false });
  });

  it('summary counts hours, days, updates, points and distance', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/summary?from=2026-10-05&to=2026-10-05`).expect(200);
    expect(res.body).toMatchObject({ totalMinutes: 150, daysWorked: 1, updateCount: 3, pointCount: 3, leftRunning: false });
    expect(res.body.distanceKm).toBeGreaterThan(0);
  });

  it('updates are newest first, paged and filterable by category', async () => {
    const { admin, emp } = await seeded();
    const page1 = await get(admin.token, `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05&pageSize=2`).expect(200);
    expect(page1.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page1.body.items.map((u: { text: string }) => u.text)).toEqual(['Update number 2', 'Update number 1']);
    const voice = await get(admin.token, `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05&category=SITE_VISIT`).expect(200);
    expect(voice.body.items).toHaveLength(1);
  });

  it('flags a session left running for more than 14 hours', async () => {
    const { admin, emp } = await seeded();
    await prisma.workSession.create({
      data: {
        companyId: admin.user.companyId,
        employeeId: emp.id,
        startedAtServer: new Date(Date.now() - 20 * 3600_000),
      },
    });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const res = await get(admin.token, `/employees/${emp.id}/summary?from=${yesterday}&to=${today}`).expect(200);
    expect(res.body.leftRunning).toBe(true);
  });

  it("every activity route returns 404 for another company's employee", async () => {
    const { emp } = await seeded();
    const other = await signupAs(app);
    for (const path of [
      `/employees/${emp.id}`,
      `/employees/${emp.id}/sessions?from=2026-10-05&to=2026-10-05`,
      `/employees/${emp.id}/summary?from=2026-10-05&to=2026-10-05`,
      `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05`,
      `/employees/${emp.id}/location-trail?from=2026-10-05&to=2026-10-05`,
    ]) {
      const res = await get(other.token, path).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('refuses bad ranges with field messages', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/sessions?from=2026-08-01&to=2026-10-06`).expect(400);
    expect(res.body.error.details.fields.from).toBe('Choose at most 31 days.');
  });
});
