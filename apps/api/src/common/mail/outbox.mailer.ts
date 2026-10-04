import { Injectable, Logger } from '@nestjs/common';
import { Mailer, type MailMessage } from './mailer.js';

const KEEP = 50;

/**
 * Dev/test mailer: prints each email to the API log and keeps the last 50 in memory
 * (tests read them). Swapped for a real provider once mail credentials exist.
 */
@Injectable()
export class OutboxMailer extends Mailer {
  private readonly logger = new Logger('Mail');
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > KEEP) this.sent.shift();
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
  }
}
