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

  it('lists audit logs with labels, resolved actors, filtering, and metadata whitelist', async () => {
    const adminA = await signupAs(app);
    const empA = await employeeAs(app, prisma, adminA.user.companyId);

    // 1. Employee access is denied
    const empRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${empA.token}`);
    expect(empRes.status).toBe(403);

    // 2. Admin login creates admin.signed_in audit entry
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminA.user.email, password: 'StrongPass1' });
    expect(loginRes.status).toBe(200);

    // 3. Create an invitation creates invitation.created audit entry
    const inviteRes = await request(app.getHttpServer())
      .post('/api/v1/employees/invitations')
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ name: 'Audit Test Employee', email: 'auditemp@example.com' });
    expect(inviteRes.status).toBe(201);

    // 4. Report download audit entry with whitelisted + secret metadata
    const reportId = randomUUID();
    await prisma.auditLog.create({
      data: {
        companyId: adminA.user.companyId,
        actorUserId: adminA.user.id,
        action: 'report.downloaded',
        entityType: 'report',
        entityId: reportId,
        metadata: {
          format: 'pdf',
          byteSize: 2048,
          secretInternalKey: 'must-be-scrubbed-out',
        },
      },
    });

    // 5. Retention change creates retention.updated audit entry
    const retRes = await request(app.getHttpServer())
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ preciseLocationRetentionDays: 45 });
    expect(retRes.status).toBe(200);

    // 6. GET /audit-logs lists them newest first with labels and actor names
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(4);

    const items = listRes.body.items;
    // Newest first check
    for (let i = 0; i < items.length - 1; i++) {
      expect(new Date(items[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(items[i + 1].createdAt).getTime(),
      );
    }

    // Verify retention.updated item
    const retItem = items.find((i: any) => i.action === 'retention.updated');
    expect(retItem).toBeDefined();
    expect(retItem.label).toBe('Updated data retention period');
    expect(retItem.actorName).toBe(adminA.user.name);

    // Verify report.downloaded item and metadata whitelist
    const reportItem = items.find((i: any) => i.action === 'report.downloaded');
    expect(reportItem).toBeDefined();
    expect(reportItem.label).toBe('Downloaded a PDF report');
    expect(reportItem.details.format).toBe('pdf');
    expect(reportItem.details.byteSize).toBe(2048);
    expect((reportItem.details as any).secretInternalKey).toBeUndefined();

    // Verify invitation.created item
    const inviteItem = items.find((i: any) => i.action === 'invitation.created');
    expect(inviteItem).toBeDefined();
    expect(inviteItem.label).toBe('Created an employee invitation');

    // 7. Filter by action=report.downloaded gives one row
    const filterRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?action=report.downloaded')
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.items).toHaveLength(1);
    expect(filterRes.body.items[0].action).toBe('report.downloaded');

    // 8. Another company sees none of company A's audit logs
    const adminB = await signupAs(app);
    const listBRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?action=report.downloaded')
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(listBRes.status).toBe(200);
    expect(listBRes.body.items).toHaveLength(0);
  });
});
