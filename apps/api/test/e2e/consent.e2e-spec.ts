import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';
import { PRIVACY_NOTICE_VERSION } from '@worktrail/types';

describe('Privacy notice and consent (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);
  });

  afterAll(async () => {
    delete process.env.PRIVACY_NOTICE_VERSION_OVERRIDE;
    await app.close();
    await prisma.$disconnect();
  });

  it('enforces consent before starting work session and supports full consent flow', async () => {
    const admin = await signupAs(app);
    const emp = await employeeAs(app, prisma, admin.user.companyId, false);

    // 1. New employee attempting to start session without consent -> 409 CONSENT_REQUIRED
    const startRes1 = await request(app.getHttpServer())
      .post('/api/v1/sessions/start')
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        deviceTime: new Date().toISOString(),
      });

    expect(startRes1.status).toBe(409);
    expect(startRes1.body?.error?.code).toBe('CONSENT_REQUIRED');

    // 2. GET /privacy/notice returns version, sections, retentionDays
    const noticeRes = await request(app.getHttpServer())
      .get('/api/v1/privacy/notice')
      .set('Authorization', `Bearer ${emp.token}`);

    expect(noticeRes.status).toBe(200);
    expect(noticeRes.body.version).toBe(PRIVACY_NOTICE_VERSION);
    expect(noticeRes.body.sections.length).toBe(6);
    expect(noticeRes.body.retentionDays).toBe(90);

    // 3. POST /me/consent with wrong version -> 400
    const wrongVersionRes = await request(app.getHttpServer())
      .post('/api/v1/me/consent')
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        version: 'old-version-xyz',
      });

    expect(wrongVersionRes.status).toBe(400);
    expect(wrongVersionRes.body?.error?.message).toContain('Please reload the notice');

    // 4. Admin token on POST /me/consent -> 403
    const adminConsentRes = await request(app.getHttpServer())
      .post('/api/v1/me/consent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        version: PRIVACY_NOTICE_VERSION,
      });

    expect(adminConsentRes.status).toBe(403);

    // 5. POST /me/consent -> 201
    const consentRes = await request(app.getHttpServer())
      .post('/api/v1/me/consent')
      .set('Authorization', `Bearer ${emp.token}`)
      .set('x-forwarded-for', '203.0.113.195')
      .send({
        version: PRIVACY_NOTICE_VERSION,
        appVersion: '1.0.0',
        deviceModel: 'Pixel 8',
      });

    expect(consentRes.status).toBe(201);
    expect(consentRes.body.version).toBe(PRIVACY_NOTICE_VERSION);
    expect(consentRes.body.acceptedAt).toBeDefined();

    // 6. Second consent with same version is idempotent and returns existing acceptedAt
    const secondConsentRes = await request(app.getHttpServer())
      .post('/api/v1/me/consent')
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        version: PRIVACY_NOTICE_VERSION,
      });

    expect(secondConsentRes.status).toBe(201);
    expect(secondConsentRes.body.acceptedAt).toBe(consentRes.body.acceptedAt);

    // 7. Audit log exists with action consent.recorded and ip
    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: admin.user.companyId,
        action: 'consent.recorded',
        entityId: emp.employee.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.ip).toBe('203.0.113.195');

    // 8. Now starting session works!
    const startRes2 = await request(app.getHttpServer())
      .post('/api/v1/sessions/start')
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        deviceTime: new Date().toISOString(),
      });

    expect(startRes2.status).toBe(201);
    expect(startRes2.body.session?.id).toBeDefined();

    // End the active session so later operations aren't blocked
    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${startRes2.body.session.id}/end`)
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        deviceTime: new Date().toISOString(),
      });

    // 9. GET /employees/:id shows consentedAt and consentVersion
    const empDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/employees/${emp.employee.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(empDetailRes.status).toBe(200);
    expect(empDetailRes.body.consentedAt).toBe(consentRes.body.acceptedAt);
    expect(empDetailRes.body.consentVersion).toBe(PRIVACY_NOTICE_VERSION);
    expect(empDetailRes.body.deactivated).toBe(false);

    // 10. Version override makes starting session require consent again (409)
    process.env.PRIVACY_NOTICE_VERSION_OVERRIDE = '2026-11-v2';
    try {
      const startRes3 = await request(app.getHttpServer())
        .post('/api/v1/sessions/start')
        .set('Authorization', `Bearer ${emp.token}`)
        .send({
          deviceTime: new Date().toISOString(),
        });

      expect(startRes3.status).toBe(409);
      expect(startRes3.body?.error?.code).toBe('CONSENT_REQUIRED');
    } finally {
      delete process.env.PRIVACY_NOTICE_VERSION_OVERRIDE;
    }
  });
});
