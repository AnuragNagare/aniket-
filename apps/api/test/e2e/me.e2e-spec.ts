import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { employeeAs, signupAs } from '../helpers/auth.js';
import { resetDb } from '../helpers/db.js';

const prisma = new PrismaClient();

describe('GET /me', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns the employee record and company for an employee', async () => {
    const e = await employeeAs(app, prisma);
    await prisma.employee.update({
      where: { id: e.employee.id },
      data: { designation: 'Field Technician' },
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${e.token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      user: { role: 'EMPLOYEE', email: e.user.email },
      employee: { id: e.employee.id, designation: 'Field Technician' },
      company: { timezone: 'Asia/Kolkata' },
    });
  });

  it('returns employee: null for an admin', async () => {
    const a = await signupAs(app);
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body.employee).toBeNull();
    expect(res.body.company.name).toEqual(expect.any(String));
  });
});
