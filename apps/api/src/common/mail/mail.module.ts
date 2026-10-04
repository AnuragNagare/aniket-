import { Global, Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { OutboxMailer } from './outbox.mailer.js';

@Global()
@Module({ providers: [{ provide: Mailer, useClass: OutboxMailer }], exports: [Mailer] })
export class MailModule {}
