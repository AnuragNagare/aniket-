import type { NextResponse } from 'next/server';
import type { AuthTokens } from '@worktrail/types';

/**
 * The browser never sees API tokens: both live in httpOnly cookies set by our own
 * route handlers and the proxy.
 */
export const ACCESS_COOKIE = 'wt_at';
export const REFRESH_COOKIE = 'wt_rt';

type ResponseCookies = NextResponse['cookies'];

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
const REFRESH_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86_400;

const base = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookies(
  jar: ResponseCookies,
  tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>,
) {
  // Expire the access cookie 30s before the JWT so the proxy refreshes before the API would 401.
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: Math.max(ACCESS_TTL_SECONDS - 30, 60),
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: REFRESH_TTL_SECONDS });
}

export function clearSessionCookies(jar: ResponseCookies) {
  jar.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  jar.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}
