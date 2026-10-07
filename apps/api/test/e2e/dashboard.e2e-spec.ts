import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds, previousDay, todayIn } from '../../src/common/utils/time.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

describe('GET /dashboard', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('aggregates only own-company data for the IST day', async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    const cid = a.user.companyId;
    // Yesterday (IST), so the fixed 03:00–05:00 session is fully in the past whenever this runs.
    const day = previousDay(todayIn(TZ));
    const { start } = dayBounds(day, TZ);
    const amit = await makeEmployee(prisma, cid, { name: 'Amit Kumar', designation: 'Field Sales' });
    await makeEmployee(prisma, cid, { name: 'Neha Patel' });
    await makeEmployee(prisma, b.user.companyId, { name: 'Other Co Person' });

    const s = await prisma.workSession.create({
      data: {
        companyId: cid,
        employeeId: amit.id,
        status: 'COMPLETED',
        startedAtServer: new Date(start.getTime() + 3 * 3600_000),
        endedAtServer: new Date(start.getTime() + 5 * 3600_000),
      },
    });
    await prisma.locationPoint.create({
      data: {
        companyId: cid,
        employeeId: amit.id,
        sessionId: s.id,
        clientPointId: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f',
        latitude: 19.076,
        longitude: 72.8777,
        source: 'END',
        capturedAt: new Date(start.getTime() + 5 * 3600_000),
      },
    });
    await prisma.workUpdate.create({
      data: {
        companyId: cid,
        employeeId: amit.id,
        sessionId: s.id,
        clientUpdateId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
        text: 'Met client at ABC Traders.',
        inputMethod: 'VOICE',
        category: 'SITE_VISIT',
        submittedAt: new Date(start.getTime() + 4 * 3600_000),
        summaryStatus: 'COMPLETE',
        aiSummary: 'Met client at ABC Traders.',
      },
    });

    const res = await http()
      .get(`/api/v1/dashboard?date=${day}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);

    expect(res.body.date).toBe(day);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.kpis).toMatchObject({
      totalEmployees: 2,
      workingNow: 0,
      checkedInToday: 1,
      workMinutesToday: 120,
      updatesToday: 1,
      updatesYesterday: 0,
    });
    expect(res.body.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Amit Kumar',
          status: 'OFF_DUTY',
          lastPoint: expect.objectContaining({ latitude: 19.076 }),
        }),
        expect.objectContaining({ name: 'Neha Patel', lastPoint: null }),
      ]),
    );
    expect(res.body.recentUpdates[0]).toMatchObject({
      employeeName: 'Amit Kumar',
      text: 'Met client at ABC Traders.',
      category: 'SITE_VISIT',
      inputMethod: 'VOICE',
      summary: 'Met client at ABC Traders.',
    });
    expect(res.body.workHours).toEqual([{ employeeId: amit.id, name: 'Amit Kumar', minutes: 120 }]);
    expect(JSON.stringify(res.body)).not.toContain('Other Co Person');
  });

  it('defaults to today in the company timezone', async () => {
    const a = await signupAs(app);
    const res = await http()
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body.date).toBe(todayIn(TZ));
    expect(res.body.kpis.totalEmployees).toBe(0);
  });

  it('rejects a bad date', async () => {
    const a = await signupAs(app);
    const res = await http()
      .get('/api/v1/dashboard?date=2026-13-45')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_DATE');
  });
});
