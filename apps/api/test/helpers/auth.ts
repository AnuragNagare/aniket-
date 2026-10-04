import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { AuthTokens } from '@worktrail/types';

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
