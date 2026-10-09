import { Global, Logger, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { Mailer } from './mailer.js';
import { OutboxMailer } from './outbox.mailer.js';
import { ResendMailer } from './resend.mailer.js';

/** Real email when RESEND_API_KEY is set (never under test); otherwise the logging outbox. */
export const pickMailer = (env: Env): Mailer => {
  if (env.RESEND_API_KEY && env.NODE_ENV !== 'test') {
    return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  }
  if (env.NODE_ENV === 'production') {
    new Logger('Mail').warn('RESEND_API_KEY is not set: emails are only printed to the log and not delivered.');
  }
  return new OutboxMailer();
};

@Global()
@Module({
  providers: [{ provide: Mailer, useFactory: pickMailer, inject: [ENV] }],
  exports: [Mailer],
})
export class MailModule {}
