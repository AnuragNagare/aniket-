import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

describe('GET /me/history', () => {
  let app: INestApplication;
  const get = (token: string, q: string) =>
    request(app.getHttpServer()).get(`/api/v1/me/history?${q}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns only my sessions and updates in the range, including overnight sessions', async () => {
    const me = await employeeAs(app, prisma);
    const colleague = await employeeAs(app, prisma, me.user.companyId);
    const d4 = dayBounds('2026-10-04', TZ);
    // 23:30–00:30 IST across 4→5 Oct.
    const overnight = await prisma.workSession.create({
      data: {
        companyId: me.user.companyId,
        employeeId: me.employee.id,
        status: 'COMPLETED',
        startedAtServer: new Date(d4.end.getTime() - 30 * 60_000),
        endedAtServer: new Date(d4.end.getTime() + 30 * 60_000),
        totalMinutes: 60,
      },
    });
    await prisma.workUpdate.create({
      data: {
        companyId: me.user.companyId,
        employeeId: me.employee.id,
        sessionId: overnight.id,
        clientUpdateId: randomUUID(),
        text: 'Late night repair done.',
        inputMethod: 'TYPED',
        submittedAt: new Date(d4.end.getTime() - 10 * 60_000),
      },
    });
    const theirs = await prisma.workSession.create({
      data: {
        companyId: me.user.companyId,
        employeeId: colleague.employee.id,
        startedAtServer: d4.start,
        status: 'COMPLETED',
        endedAtServer: d4.end,
      },
    });

    const res = await get(me.token, 'from=2026-10-05&to=2026-10-05').expect(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual([overnight.id]);
    expect(res.body.updates).toEqual([]); // the update was on the 4th
    const both = await get(me.token, 'from=2026-10-04&to=2026-10-05').expect(200);
    expect(both.body.updates).toHaveLength(1);
    expect(JSON.stringify(both.body)).not.toContain(theirs.id);
  });

  it('rejects a range over 31 days', async () => {
    const me = await employeeAs(app, prisma);
    const res = await get(me.token, 'from=2026-08-01&to=2026-10-06').expect(400);
    expect(res.body.error.details.fields.from).toBe('Choose at most 31 days.');
  });

  it('is for employees only', async () => {
    const admin = await signupAs(app);
    await get(admin.token, 'from=2026-10-01&to=2026-10-06').expect(403);
  });
});
