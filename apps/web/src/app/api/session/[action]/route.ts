import { type NextRequest, NextResponse } from 'next/server';
import type { ApiErrorBody, AuthTokens } from '@worktrail/types';
import { apiUrl } from '@/lib/api-url';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/session';

/**
 * Browser-facing session endpoints: POST /api/session/{login|signup|logout}.
 * Forwards to the API and moves tokens into httpOnly cookies.
 */
const TARGETS: Record<string, string> = { login: '/auth/login', signup: '/auth/signup/admin' };

const errorBody = (code: string, message: string): ApiErrorBody => ({
  error: { code, message, details: {} },
});

async function logout(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Best effort: the cookies are cleared even if the API can't be reached.
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res.cookies);
  return res;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'logout') return logout(req);

  const target = TARGETS[action];
  if (!target) return NextResponse.json(errorBody('NOT_FOUND', 'Not found.'), { status: 404 });

  const rawBody = await req.text();
  let apiRes: Response;
  try {
    apiRes = await fetch(apiUrl(target), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    });
  } catch {
    return NextResponse.json(
      errorBody(
        'API_UNREACHABLE',
        'Work Trail is not reachable right now. Check your connection and try again.',
      ),
      { status: 503 },
    );
  }

  const body: unknown = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !body) return NextResponse.json(body, { status: apiRes.status });

  const tokens = body as AuthTokens;
  const res = NextResponse.json({ user: tokens.user });
  setSessionCookies(res.cookies, tokens, { persistent: wantsToBeRemembered(rawBody) });
  return res;
}

/** "Remember me" defaults to on; only an explicit `remember: false` makes it session-only. */
function wantsToBeRemembered(rawBody: string): boolean {
  try {
    return (JSON.parse(rawBody) as { remember?: unknown }).remember !== false;
  } catch {
    return true;
  }
}
