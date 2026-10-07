import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('organisation isolation', () => {
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

  it('lists only own-company employees', async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    await makeEmployee(prisma, a.user.companyId, { name: 'Asha' });
    await makeEmployee(prisma, b.user.companyId, { name: 'Bilal' });
    const res = await http()
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body.items.map((e: { name: string }) => e.name)).toEqual(['Asha']);
    expect(res.body.total).toBe(1);
  });

  it("returns 404 for another company's employee id", async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    const theirs = await makeEmployee(prisma, b.user.companyId);
    const res = await http()
      .get(`/api/v1/employees/${theirs.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('detail includes joinedAt, phone, workingSince and lastSeenAt', async () => {
    const a = await signupAs(app);
    const emp = await makeEmployee(prisma, a.user.companyId, { name: 'Asha', phone: '+919876543210' });
    const res = await http()
      .get(`/api/v1/employees/${emp.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body).toHaveProperty('joinedAt');
    expect(res.body).toMatchObject({
      name: 'Asha',
      phone: '+919876543210',
      workingSince: null,
      lastSeenAt: null,
    });
  });

  it('returns 404 (not 500) for a malformed id', async () => {
    const a = await signupAs(app);
    await http()
      .get('/api/v1/employees/not-a-uuid')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(404);
  });

  it('marks employees with an ACTIVE session as WORKING and filters by status', async () => {
    const a = await signupAs(app);
    const e1 = await makeEmployee(prisma, a.user.companyId, { name: 'Asha' });
    await makeEmployee(prisma, a.user.companyId, { name: 'Bina' });
    await prisma.workSession.create({
      data: { companyId: a.user.companyId, employeeId: e1.id, startedAtServer: new Date() },
    });
    const res = await http()
      .get('/api/v1/employees?status=WORKING')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body.items).toEqual([expect.objectContaining({ name: 'Asha', status: 'WORKING' })]);
  });

  it('searches by name and paginates', async () => {
    const a = await signupAs(app);
    for (const name of ['Asha Rao', 'Bina Shah', 'Chetan Rao']) {
      await makeEmployee(prisma, a.user.companyId, { name });
    }
    const res = await http()
      .get('/api/v1/employees?query=rao&pageSize=1&page=2')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(res.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(res.body.items.map((e: { name: string }) => e.name)).toEqual(['Chetan Rao']);
  });

  it('forbids EMPLOYEE role from the admin list', async () => {
    const a = await signupAs(app);
    await prisma.user.update({ where: { id: a.user.id }, data: { role: 'EMPLOYEE' } });
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: a.user.email, password: 'StrongPass1' });
    await http()
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });
});
