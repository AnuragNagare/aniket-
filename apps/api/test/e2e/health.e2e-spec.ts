import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';

describe('health + error envelope + security headers', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /api/v1/health reports db up and sets x-request-id, disables x-powered-by', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /api/v1/health/ready returns db up and redis disabled in inline mode', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(res.body).toEqual({ db: 'up', redis: 'disabled' });
  });

  it('preserves an incoming valid x-request-id', async () => {
    const customId = randomUUID();
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', customId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('sets strict-transport-security in production', async () => {
    const prev = process.env.NODE_ENV;
    const prevDsn = process.env.SENTRY_DSN;
    const prevLocal = process.env.ALLOW_LOCAL_STORAGE;
    const prevAi = process.env.AI_ENABLED;

    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://fake@sentry.io/1';
    process.env.ALLOW_LOCAL_STORAGE = 'true';
    process.env.AI_ENABLED = 'false';

    try {
      const prodApp = await createApp();
      await prodApp.init();
      const res = await request(prodApp.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.headers['strict-transport-security']).toBeDefined();
      await prodApp.close();
    } finally {
      process.env.NODE_ENV = prev;
      process.env.SENTRY_DSN = prevDsn;
      process.env.ALLOW_LOCAL_STORAGE = prevLocal;
      process.env.AI_ENABLED = prevAi;
    }
  });

  it('unknown route uses the error envelope and has x-request-id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), details: {} },
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
