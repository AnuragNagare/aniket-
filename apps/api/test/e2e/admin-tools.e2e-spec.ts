import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';

describe('Admin tools: deactivate, reactivate, password reset (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    process.env.AUTH_CACHE_TTL_MS = '0';
    app = await createApp();
    await app.init();
    await resetDb(prisma);
  });

  afterAll(async () => {
    delete process.env.AUTH_CACHE_TTL_MS;
    await app.close();
    await prisma.$disconnect();
  });

  it('deactivates an employee with active session, revokes tokens, blocks access and refresh', async () => {
    const adminA = await signupAs(app);
    const empA = await employeeAs(app, prisma, adminA.user.companyId);

    // 1. Start an active work session for empA
    const startRes = await request(app.getHttpServer())
      .post('/api/v1/sessions/start')
      .set('Authorization', `Bearer ${empA.token}`)
      .send({
        point: {
          clientPointId: '00000000-0000-0000-0000-000000000001',
          latitude: 12.9716,
          longitude: 77.5946,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
        },
        deviceTime: new Date().toISOString(),
      });
    expect(startRes.status).toBe(201);
    const sessionId = startRes.body.session.id;

    // 2. Admin A deactivates employee A
    const deactRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/deactivate`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(deactRes.status).toBe(200);

    // Verify session ended as INCOMPLETE
    const sessionRow = await prisma.workSession.findUnique({ where: { id: sessionId } });
    expect(sessionRow?.status).toBe('INCOMPLETE');
    expect(sessionRow?.endedAtServer).not.toBeNull();

    // Verify user is DISABLED
    const userRow = await prisma.user.findUnique({ where: { id: empA.user.id } });
    expect(userRow?.status).toBe('DISABLED');

    // 3. EmpA access token fails with 401 ACCOUNT_DISABLED
    const testReq = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${empA.token}`);
    expect(testReq.status).toBe(401);
    expect(testReq.body?.error?.code).toBe('ACCOUNT_DISABLED');

    // 4. EmpA refresh token fails with 401 ACCOUNT_DISABLED
    const refreshReq = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: empA.refreshToken });
    expect(refreshReq.status).toBe(401);
    expect(refreshReq.body?.error?.code).toBe('ACCOUNT_DISABLED');

    // 5. Deactivating again returns 409
    const deactAgain = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/deactivate`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(deactAgain.status).toBe(409);

    // 6. Admin A reactivates employee A
    const reactRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/reactivate`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(reactRes.status).toBe(200);

    // Verify employee can sign in now
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: empA.user.email, password: 'StrongPass1' });
    expect(loginRes.status).toBe(200);

    // 7. Password reset sends email
    const resetRes = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/password-reset`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(resetRes.status).toBe(200);


    // Verify audit logs exist
    const deactAudit = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'employee.deactivated' },
    });
    expect(deactAudit).not.toBeNull();
    const reactAudit = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'employee.reactivated' },
    });
    expect(reactAudit).not.toBeNull();
    const resetAudit = await prisma.auditLog.findFirst({
      where: { companyId: adminA.user.companyId, action: 'employee.password_reset_sent' },
    });
    expect(resetAudit).not.toBeNull();

    // 8. Another company cannot manage empA -> 404
    const adminB = await signupAs(app);
    const deactB = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/deactivate`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(deactB.status).toBe(404);

    const reactB = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/reactivate`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(reactB.status).toBe(404);

    const resetB = await request(app.getHttpServer())
      .post(`/api/v1/employees/${empA.employee.id}/password-reset`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(resetB.status).toBe(404);
  });
});
