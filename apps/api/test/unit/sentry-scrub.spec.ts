import { describe, expect, it } from 'vitest';
import { scrubEvent } from '../../src/instrument.js';

describe('sentry scrubEvent', () => {
  it('removes request data, cookies, Authorization header, auth query strings, sensitive extra fields and scrubs user to id only', () => {
    const rawEvent = {
      request: {
        url: 'http://localhost:4000/api/v1/invitations/x?token=abc',
        query_string: 'token=abc',
        data: { password: 'pass', email: 'user@example.com' },
        cookies: { session: 'xyz' },
        headers: {
          authorization: 'Bearer secret_token',
          'user-agent': 'vitest-client',
        },
      },
      extra: {
        latitude: 19.07,
        longitude: 72.87,
        text: 'Met client at site',
        phone: '+919800000000',
        password: 'plain_password',
        safeMetric: 42,
      },
      user: {
        id: 'user-uuid-1',
        email: 'user@example.com',
        username: 'john_doe',
      },
    };

    const scrubbed = scrubEvent(rawEvent);

    // Request data & cookies removed
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.authorization).toBeUndefined();
    expect(scrubbed.request?.headers?.['user-agent']).toBe('vitest-client');

    // Query string stripped on invitations
    expect(scrubbed.request?.url).toBe('http://localhost:4000/api/v1/invitations/x');
    expect(scrubbed.request?.query_string).toBeUndefined();

    // Extra fields: sensitive keys removed, safe kept
    expect(scrubbed.extra).toEqual({ safeMetric: 42 });

    // User context reduced to id only
    expect(scrubbed.user).toEqual({ id: 'user-uuid-1' });
  });
});
