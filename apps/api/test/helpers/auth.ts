import argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { AuthTokens } from '@worktrail/types';
import request from 'supertest';

let n = 0;

/** Signs up a fresh company + OWNER and returns its access token and user. */
export async function signupAs(app: INestApplication, overrides: Record<string, string> = {}) {
  n += 1;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/signup/admin')
    .send({
      companyName: `Co ${n}`,
      name: `Admin ${n}`,
      email: `admin${n}@co${n}.in`,
      phone: '9876543210',
      password: 'StrongPass1',
      ...overrides,
    })
    .expect(201);
  const body = res.body as AuthTokens;
  return { token: body.accessToken, user: body.user };
}

/** Creates an EMPLOYEE user with a linked employee record and signs them in. */
export async function employeeAs(
  app: INestApplication,
  prisma: PrismaClient,
  companyId?: string,
  autoConsent = true,
) {
  n += 1;
  const cid = companyId ?? (await signupAs(app)).user.companyId;
  const email = `emp${n}@field${n}.in`;
  const passwordHash = await argon2.hash('StrongPass1', { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { companyId: cid, role: 'EMPLOYEE', name: `Field ${n}`, email, passwordHash },
  });
  const employee = await prisma.employee.create({
    data: { companyId: cid, userId: user.id, name: `Field ${n}`, email },
  });
  if (autoConsent) {
    await prisma.consentRecord.create({
      data: {
        companyId: cid,
        employeeId: employee.id,
        version: process.env.PRIVACY_NOTICE_VERSION_OVERRIDE || '2026-10-v1',
      },
    });
  }
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: 'StrongPass1' })
    .expect(200);
  const body = res.body as AuthTokens;
  return { token: body.accessToken, refreshToken: body.refreshToken, user: body.user, employee };
}

