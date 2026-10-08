import { PRIVACY_NOTICE_VERSION, type PrivacyNotice } from '@worktrail/types';

export function getPrivacyNotice(companyName: string, retentionDays: number): PrivacyNotice {
  return {
    version: process.env.PRIVACY_NOTICE_VERSION_OVERRIDE || PRIVACY_NOTICE_VERSION,
    title: 'Privacy Notice',
    retentionDays,
    sections: [
      {
        heading: 'What we collect',
        body: 'Location (latitude, longitude, accuracy, speed, battery level) about every 5 minutes; the start and end times of work; the updates you write or speak.',
      },
      {
        heading: 'When',
        body: 'Only between Start work and End work. Never when you are off duty. A notification is always visible while tracking is on.',
      },
      {
        heading: 'Why',
        body: 'So your company can see work hours, routes between work locations, and your reports.',
      },
      {
        heading: 'Who can see it',
        body: `Admins of ${companyName}. Work Trail staff only for support, when your company asks. AI summaries are made from your update text only. Your location is never sent to the AI.`,
      },
      {
        heading: 'How long',
        body: `Precise locations are deleted after ${retentionDays} days. Work hours and updates are kept as your company's work record.`,
      },
      {
        heading: 'Your choices',
        body: 'Tap End work at any time to stop. Turn off location permission in Android settings. Ask your company to delete your data from Profile -> Privacy.',
      },
    ],
  };
}
