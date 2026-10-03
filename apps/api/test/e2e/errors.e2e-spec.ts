import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorEnvelopeFilter } from '../../src/common/filters/error-envelope.filter.js';
import { createApp } from '../../src/bootstrap.js';

describe('error envelope edge cases', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  afterAll(() => app.close());

  it('malformed JSON is a 400 with a plain message, not a 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('content-type', 'application/json')
      .send('{"email": "a@b.in",')
      .expect(400);
    expect(res.body.error).toEqual({
      code: 'BAD_REQUEST',
      message: 'The request could not be read. Send valid JSON.',
      details: {},
    });
  });

  it('rate limiting tells the person what to do, without framework jargon', () => {
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => res }) };
    new ErrorEnvelopeFilter().catch(new ThrottlerException(), host as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Wait a minute and try again.',
        details: {},
      },
    });
  });
});
