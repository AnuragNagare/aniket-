import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';

describe('Company and account settings (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('validates and updates company settings and audits retention changes', async () => {
    const admin = await signupAs(app);
    const emp = await employeeAs(app, prisma, admin.user.companyId);

    // 1. Employee token on PATCH /company -> 403
    const empRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${emp.token}`)
      .send({ name: 'Hacked' });
    expect(empRes.status).toBe(403);

    // 2. Retention < 30 -> 400 "Choose between 30 and 365 days."
    const lowRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ preciseLocationRetentionDays: 20 });
    expect(lowRes.status).toBe(400);
    expect(lowRes.body?.error?.details?.fields?.preciseLocationRetentionDays).toBe('Choose between 30 and 365 days.');

    // 3. Retention > 365 -> 400
    const highRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ preciseLocationRetentionDays: 400 });
    expect(highRes.status).toBe(400);
    expect(highRes.body?.error?.details?.fields?.preciseLocationRetentionDays).toBe('Choose between 30 and 365 days.');

    // 4. Invalid timezone -> 400
    const tzRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ timezone: 'Mars/Base' });
    expect(tzRes.status).toBe(400);
    expect(tzRes.body?.error?.details?.fields?.timezone).toBe('Invalid IANA timezone.');

    // 5. Valid update: change retention to 60 -> 200 with retention.updated audit
    const validRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ preciseLocationRetentionDays: 60 });
    expect(validRes.status).toBe(200);
    expect(validRes.body.preciseLocationRetentionDays).toBe(60);

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: admin.user.companyId,
        action: 'retention.updated',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ from: 90, to: 60 });

    // 6. GET /company returns updated company
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/company')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.preciseLocationRetentionDays).toBe(60);
  });

  it('manages account profile and password change with token revocation', async () => {
    const admin = await signupAs(app);

    // 1. PATCH /me/account updates admin profile
    const updateAccRes = await request(app.getHttpServer())
      .patch('/api/v1/me/account')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Admin Renamed', phone: '+919999988888' });
    expect(updateAccRes.status).toBe(200);
    expect(updateAccRes.body.name).toBe('Admin Renamed');

    // 2. POST /me/password with wrong current password -> 400
    const wrongPassRes = await request(app.getHttpServer())
      .post('/api/v1/me/password')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ current: 'WrongPassword', next: 'NewStrongPassword123' });
    expect(wrongPassRes.status).toBe(400);
    expect(wrongPassRes.body?.error?.message).toBe('Your current password is incorrect.');

    // Create an active refresh token to verify it gets revoked
    const refreshRow = await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: admin.user.id,
        tokenHash: 'sample-hash-value',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 3. POST /me/password with right current password -> 200 and revokes tokens
    const rightPassRes = await request(app.getHttpServer())
      .post('/api/v1/me/password')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ current: 'StrongPass1', next: 'NewStrongPassword123' });
    expect(rightPassRes.status).toBe(200);

    const checkToken = await prisma.refreshToken.findUnique({
      where: { id: refreshRow.id },
    });
    expect(checkToken?.revokedAt).not.toBeNull();

    // Verify admin can sign in with new password
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.user.email, password: 'NewStrongPassword123' });
    expect(loginRes.status).toBe(200);
  });
});
