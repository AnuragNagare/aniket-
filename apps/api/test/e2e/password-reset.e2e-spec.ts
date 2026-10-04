import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';
import { lastMailTo, linkIn, outbox } from '../helpers/mail.js';

const prisma = new PrismaClient();

describe('password reset', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const forgot = (email: string) => http().post('/api/v1/auth/forgot-password').send({ email });
  const reset = (token: string, password = 'NewStrongPass2') =>
    http().post('/api/v1/auth/reset-password').send({ token, password });

  async function requestLink() {
    const a = await signupAs(app);
    await forgot(a.user.email).expect(204);
    const link = linkIn(lastMailTo(app, a.user.email))!;
    return { a, link, token: new URL(link).searchParams.get('token')! };
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    outbox(app).sent.length = 0;
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('emails a 1-hour reset link to a known address', async () => {
    const { link, a } = await requestLink();
    expect(link).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=[\w-]{43}$/);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: a.user.id } });
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('answers an unknown email exactly the same way and sends nothing', async () => {
    const res = await forgot('nobody@example.com').expect(204);
    expect(res.text).toBe('');
    expect(outbox(app).sent).toHaveLength(0);
  });

  it('reset sets the new password, ends every session and is audited', async () => {
    const { a, token } = await requestLink();
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: a.user.email, password: 'StrongPass1' });
    await reset(token).expect(204);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: a.user.email, password: 'StrongPass1' })
      .expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: a.user.email, password: 'NewStrongPass2' })
      .expect(200);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    expect(
      await prisma.auditLog.count({ where: { action: 'password.reset', entityId: a.user.id } }),
    ).toBe(1);
  });

  it('a reset link works once', async () => {
    const { token } = await requestLink();
    await reset(token).expect(204);
    const again = await reset(token, 'AnotherPass3').expect(400);
    expect(again.body.error).toMatchObject({
      code: 'RESET_LINK_INVALID',
      message: 'This reset link has expired or was already used. Request a new one.',
    });
  });

  it('an expired link is refused', async () => {
    const { token } = await requestLink();
    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await reset(token).expect(400);
  });

  it('a newer link replaces older unused ones', async () => {
    const { a, token: first } = await requestLink();
    await forgot(a.user.email).expect(204);
    const second = new URL(linkIn(lastMailTo(app, a.user.email))!).searchParams.get('token')!;
    await reset(second).expect(204);
    await reset(first, 'AnotherPass3').expect(400);
  });

  it('a weak new password is a field error', async () => {
    const { token } = await requestLink();
    const res = await reset(token, 'short').expect(400);
    expect(res.body.error.details.fields.password).toBe('Use at least 8 characters.');
  });
});
