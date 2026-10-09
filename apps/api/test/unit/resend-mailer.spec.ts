import { pickMailer } from '../../src/common/mail/mail.module.js';
import { OutboxMailer } from '../../src/common/mail/outbox.mailer.js';
import { ResendMailer } from '../../src/common/mail/resend.mailer.js';
import { loadEnv } from '../../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};
const msg = { to: 'a@b.in', subject: 'Hi', text: 'Body' };

describe('ResendMailer', () => {
  it('posts the message to Resend with the bearer key', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await new ResendMailer('key_1', 'Work Trail <n@w.in>', fetchFn as never).send(msg);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer key_1');
    expect(JSON.parse(init.body)).toEqual({ from: 'Work Trail <n@w.in>', to: ['a@b.in'], subject: 'Hi', text: 'Body' });
  });

  it('throws when Resend refuses, so the caller can report emailSent: false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    await expect(new ResendMailer('k', 'f', fetchFn as never).send(msg)).rejects.toThrow('HTTP 422');
  });
});

describe('pickMailer', () => {
  it('uses Resend when a key is set outside tests', () => {
    expect(pickMailer(loadEnv({ ...base, NODE_ENV: 'development', RESEND_API_KEY: 'k' }))).toBeInstanceOf(ResendMailer);
  });
  it('uses the outbox without a key', () => {
    expect(pickMailer(loadEnv({ ...base, NODE_ENV: 'development' }))).toBeInstanceOf(OutboxMailer);
  });
  it('always uses the outbox under test, even with a key', () => {
    expect(pickMailer(loadEnv({ ...base, NODE_ENV: 'test', RESEND_API_KEY: 'k' }))).toBeInstanceOf(OutboxMailer);
  });
});
