import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('GET /employees/:id/location-trail', () => {
  let app: INestApplication;
  const trail = (token: string, id: string, q = 'from=2026-10-05&to=2026-10-05') =>
    request(app.getHttpServer()).get(`/api/v1/employees/${id}/location-trail?${q}`).set('Authorization', `Bearer ${token}`);

  async function withPoints(minutes: number[], quality: Record<number, 'LOW_ACCURACY'> = {}) {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid);
    const start = new Date(dayBounds('2026-10-05', 'Asia/Kolkata').start.getTime() + 3 * 3600_000);
    const s = await prisma.workSession.create({
      data: {
        companyId: cid,
        employeeId: emp.id,
        status: 'COMPLETED',
        startedAtServer: start,
        endedAtServer: new Date(start.getTime() + 120 * 60_000),
      },
    });
    await prisma.locationPoint.createMany({
      data: minutes.map((m, i) => ({
        companyId: cid,
        employeeId: emp.id,
        sessionId: s.id,
        clientPointId: randomUUID(),
        latitude: 19 + i * 0.001,
        longitude: 72.8,
        accuracyMeters: quality[m] ? 300 : 15,
        qualityFlag: quality[m] ?? 'GOOD',
        source: i === 0 ? ('START' as const) : ('BACKGROUND' as const),
        capturedAt: new Date(start.getTime() + m * 60_000),
      })),
    });
    return { admin, emp, s };
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

  it('returns ordered points, the session, gaps and stats', async () => {
    const { admin, emp, s } = await withPoints([0, 5, 10, 60, 65], { 65: 'LOW_ACCURACY' });
    const res = await trail(admin.token, emp.id).expect(200);
    expect(res.body.sessions).toEqual([expect.objectContaining({ id: s.id, status: 'COMPLETED' })]);
    expect(res.body.points.map((p: { source: string }) => p.source)).toEqual(['START', 'BACKGROUND', 'BACKGROUND', 'BACKGROUND', 'BACKGROUND']);
    expect(res.body.gaps.map((g: { minutes: number }) => g.minutes)).toEqual([50, 55]);
    expect(res.body.stats).toMatchObject({ pointCount: 5, lowAccuracyCount: 1, gapCount: 2 });
    expect(res.body.truncated).toBe(false);
  });

  it('an empty period returns no points and no crash', async () => {
    const { admin, emp } = await withPoints([0]);
    const res = await trail(admin.token, emp.id, 'from=2026-10-01&to=2026-10-01').expect(200);
    expect(res.body).toMatchObject({ points: [], sessions: [], gaps: [], stats: { pointCount: 0, distanceKm: 0 } });
  });

  it('caps very large trails and says so', async () => {
    const { admin, emp, s } = await withPoints([]);
    await prisma.locationPoint.createMany({
      data: Array.from({ length: 5003 }, (_, i) => ({
        companyId: admin.user.companyId,
        employeeId: emp.id,
        sessionId: s.id,
        clientPointId: randomUUID(),
        latitude: 19,
        longitude: 72.8,
        source: 'BACKGROUND' as const,
        capturedAt: new Date(s.startedAtServer.getTime() + i * 1000),
      })),
    });
    const res = await trail(admin.token, emp.id).expect(200);
    expect(res.body.points).toHaveLength(5000);
    expect(res.body.truncated).toBe(true);
  });

  it('is admin-only and company-scoped', async () => {
    const { emp } = await withPoints([0]);
    const other = await signupAs(app);
    await trail(other.token, emp.id).expect(404);
  });
});
