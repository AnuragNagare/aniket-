/** The text an admin shares (WhatsApp, SMS, email...) with a new employee. */
export const inviteMessage = (company: string, name: string, url: string) =>
  `Hi ${name}, ${company || 'your company'} uses Work Trail to record work sessions and updates. ` +
  `Open this link in the Work Trail app (Get started) to join. It works once and expires in 7 days:\n${url}`;
