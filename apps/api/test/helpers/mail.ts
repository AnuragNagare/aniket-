import type { INestApplication } from '@nestjs/common';
import { Mailer, type MailMessage } from '../../src/common/mail/mailer.js';
import type { OutboxMailer } from '../../src/common/mail/outbox.mailer.js';

export const outbox = (app: INestApplication) => app.get(Mailer) as OutboxMailer;

export const lastMailTo = (app: INestApplication, email: string): MailMessage | undefined =>
  outbox(app)
    .sent.filter((m) => m.to === email)
    .at(-1);

/** Pulls the first http(s) link out of an email body. */
export const linkIn = (mail: MailMessage | undefined) => mail?.text.match(/https?:\/\/\S+/)?.[0];
