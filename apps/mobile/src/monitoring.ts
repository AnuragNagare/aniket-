import * as Sentry from '@sentry/react-native';

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
  if (event.extra) {
    event.extra = scrubObject(event.extra) as Record<string, unknown>;
  }
  if (event.user) {
    const userId = event.user.id;
    event.user = userId ? { id: userId } : undefined;
  }
  return event;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initMonitoring() {
  if (dsn) {
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      beforeSend(event) {
        return scrubEvent(event);
      },
    });
  }
}
