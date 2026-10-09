import { Injectable } from '@nestjs/common';
import { Mailer, type MailMessage } from './mailer.js';

/** Sends real email through Resend's HTTP API. Throws on any non-2xx so callers can report `emailSent: false`. */
@Injectable()
export class ResendMailer extends Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const res = await this.fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend rejected the email (HTTP ${res.status}).`);
  }
}
