import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';

const prisma = new PrismaClient();
const signup = {
  companyName: 'Acme Services',
  name: 'Rahul Sharma',
  email: 'rahul@acme.in',
  phone: '98765 43210',
  password: 'StrongPass1',
};

describe('auth', () => {
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

  it('signup creates company + OWNER and returns tokens', async () => {
    const res = await http().post('/api/v1/auth/signup/admin').send(signup).expect(201);
    expect(res.body.user).toMatchObject({
      role: 'OWNER',
      name: 'Rahul Sharma',
      email: 'rahul@acme.in',
    });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toMatch(/^[0-9a-f-]{36}\.[\w-]+$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'rahul@acme.in' } });
    expect(user.phone).toBe('+919876543210');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('concurrent signups with one email create exactly one account', async () => {
    const [a, b] = await Promise.all([
      http().post('/api/v1/auth/signup/admin').send(signup),
      http().post('/api/v1/auth/signup/admin').send({ ...signup, companyName: 'Other' }),
    ]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.company.count()).toBe(1);
  });

  it('signup validation returns field messages', async () => {
    const res = await http()
      .post('/api/v1/auth/signup/admin')
      .send({ ...signup, phone: '12345' })
      .expect(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        fields: { phone: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' },
      },
    });
  });

  it('login succeeds with any email casing and fails with one generic message', async () => {
    await http().post('/api/v1/auth/signup/admin').send(signup).expect(201);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'RAHUL@acme.in', password: 'StrongPass1' })
      .expect(200);
    const wrong = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@acme.in', password: 'nope' })
      .expect(401);
    const missing = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'x@acme.in', password: 'nope' })
      .expect(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('me requires a bearer token', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    await http().get('/api/v1/auth/me').expect(401);
    const me = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(me.body).toEqual(body.user);
  });

  it('rejects a tampered access token', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    const tampered = `${body.accessToken.slice(0, -2)}xx`;
    const res = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('refresh rotates; reusing an old refresh token revokes the whole family', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    const r1 = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(200);
    expect(r1.body.refreshToken).not.toBe(body.refreshToken);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r1.body.refreshToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    await http().post('/api/v1/auth/logout').send({ refreshToken: body.refreshToken }).expect(204);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
  });

  it('disabled users cannot log in', async () => {
    await http().post('/api/v1/auth/signup/admin').send(signup);
    await prisma.user.update({ where: { email: 'rahul@acme.in' }, data: { status: 'DISABLED' } });
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'rahul@acme.in', password: 'StrongPass1' })
      .expect(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
