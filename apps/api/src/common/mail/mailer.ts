export type MailMessage = { to: string; subject: string; text: string };

/** Sends transactional email. Abstract class so it doubles as the Nest DI token. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
