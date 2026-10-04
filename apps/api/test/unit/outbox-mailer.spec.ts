import { OutboxMailer } from '../../src/common/mail/outbox.mailer.js';

describe('OutboxMailer', () => {
  it('keeps sent messages, newest last, capped at 50', async () => {
    const mailer = new OutboxMailer();
    for (let i = 0; i < 52; i++) await mailer.send({ to: `u${i}@x.in`, subject: 's', text: 't' });
    expect(mailer.sent).toHaveLength(50);
    expect(mailer.sent.at(-1)?.to).toBe('u51@x.in');
    expect(mailer.sent[0]?.to).toBe('u2@x.in');
  });
});
