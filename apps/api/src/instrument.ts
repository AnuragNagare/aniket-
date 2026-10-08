import * as Sentry from '@sentry/nestjs';

const SENSITIVE_KEY_REGEX = /password|token|secret|latitude|longitude|text|email|phone/i;

function scrubObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      continue;
    }
    out[key] = scrubObject(val);
  }
  return out;
}

export function scrubEvent<T extends Record<string, any>>(event: T): T {
  if (!event) return event;

  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;

    if (event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['Cookie'];
    }

    if (typeof event.request.url === 'string') {
      const url = event.request.url;
      if (url.includes('/auth/') || url.includes('/invitations/')) {
        const qIdx = url.indexOf('?');
        if (qIdx !== -1) {
          event.request.url = url.slice(0, qIdx);
        }
      }
    }
    if (event.request.query_string) {
      const url = event.request.url || '';
      if (typeof url === 'string' && (url.includes('/auth/') || url.includes('/invitations/'))) {
        delete event.request.query_string;
      }
    }
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra) as Record<string, unknown>;
  }

  if (event.user) {
    const userId = event.user.id;
    event.user = userId ? { id: userId } : undefined;
  }

  return event;
}

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isProd = environment === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: isProd ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeSendTransaction(event) {
      return scrubEvent(event);
    },
  });
}
