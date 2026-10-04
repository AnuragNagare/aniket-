import { type NextRequest, NextResponse } from 'next/server';
import type { AuthTokens } from '@worktrail/types';
import { apiUrl } from '@/lib/api-url';
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  REFRESH_COOKIE,
  SESSION_ONLY_COOKIE,
  setSessionCookies,
} from '@/lib/session';

/**
 * Auth gate for the admin app:
 * - /app/** needs a session; an expired access cookie is refreshed silently.
 * - /login and /signup send an already signed-in admin to the dashboard.
 */
const AUTH_PAGES = new Set(['/login', '/signup']);

async function refresh(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const res = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return res.ok ? ((await res.json()) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (AUTH_PAGES.has(req.nextUrl.pathname)) {
    return accessToken
      ? NextResponse.redirect(new URL('/app/dashboard', req.url))
      : NextResponse.next();
  }

  if (accessToken) return NextResponse.next();
  if (!refreshToken) return NextResponse.redirect(new URL('/login', req.url));

  const tokens = await refresh(refreshToken);
  if (!tokens) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    clearSessionCookies(res.cookies);
    return res;
  }

  // Forward the new cookies on this request too, so Server Components see them immediately.
  req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const res = NextResponse.next({ request: { headers: req.headers } });
  setSessionCookies(res.cookies, tokens, {
    persistent: req.cookies.get(SESSION_ONLY_COOKIE)?.value !== '1',
  });
  return res;
}

export const config = { matcher: ['/app/:path*', '/login', '/signup'] };
