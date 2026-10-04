import { type NextRequest, NextResponse } from 'next/server';
import type { ApiErrorBody, AuthTokens } from '@worktrail/types';
import { apiUrl } from '@/lib/api-url';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/session';

/**
 * Browser-facing auth endpoints under /api/session/:action. They forward to the API and
 * keep tokens in httpOnly cookies, so browser JavaScript never sees them.
 */

/** Sign-in style actions: on success the API returns tokens and we set session cookies. */
const SESSION_TARGETS: Record<string, string> = {
  login: '/auth/login',
  signup: '/auth/signup/admin',
};

/** Public actions with no session: forward the request and pass the status/body back. */
const PASSTHROUGH_TARGETS: Record<string, string> = {
  'forgot-password': '/auth/forgot-password',
  'reset-password': '/auth/reset-password',
};

const errorBody = (code: string, message: string): ApiErrorBody => ({
  error: { code, message, details: {} },
});

const unreachable = () =>
  NextResponse.json(
    errorBody(
      'API_UNREACHABLE',
      'Work Trail is not reachable right now. Check your connection and try again.',
    ),
    { status: 503 },
  );

/** POSTs JSON to the API; null means the API couldn't be reached. */
async function forward(path: string, body: string): Promise<Response | null> {
  try {
    return await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  } catch {
    return null;
  }
}

async function passthrough(apiRes: Response) {
  if (apiRes.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await apiRes.json().catch(() => null), { status: apiRes.status });
}

async function logout(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  // Best effort: the cookies are cleared even if the API can't be reached.
  if (refreshToken) await forward('/auth/logout', JSON.stringify({ refreshToken }));
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res.cookies);
  return res;
}

async function acceptInvite(rawBody: string) {
  let parsed: { token?: unknown; name?: unknown; password?: unknown } = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // fall through to the missing-token response
  }
  const token = typeof parsed.token === 'string' ? parsed.token : '';
  if (!token) {
    return NextResponse.json(
      errorBody('INVITE_INVALID', 'This invite link is incomplete. Open it from the message again.'),
      { status: 410 },
    );
  }
  const apiRes = await forward(
    `/employees/invitations/${encodeURIComponent(token)}/accept`,
    JSON.stringify({ name: parsed.name, password: parsed.password }),
  );
  if (!apiRes) return unreachable();
  if (!apiRes.ok) return passthrough(apiRes);

  const tokens = (await apiRes.json()) as AuthTokens;
  // Employees don't get an admin web session; they sign in on the mobile app.
  await forward('/auth/logout', JSON.stringify({ refreshToken: tokens.refreshToken }));
  return NextResponse.json({ user: { name: tokens.user.name, email: tokens.user.email } });
}

async function signIn(path: string, rawBody: string) {
  const apiRes = await forward(path, rawBody);
  if (!apiRes) return unreachable();
  const body: unknown = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !body) return NextResponse.json(body, { status: apiRes.status });

  const tokens = body as AuthTokens;
  if (tokens.user.role === 'EMPLOYEE') {
    await forward('/auth/logout', JSON.stringify({ refreshToken: tokens.refreshToken }));
    return NextResponse.json(
      errorBody(
        'USE_MOBILE_APP',
        'This sign-in is for company admins. Employees sign in on the Work Trail app.',
      ),
      { status: 403 },
    );
  }
  const res = NextResponse.json({ user: tokens.user });
  setSessionCookies(res.cookies, tokens, { persistent: wantsToBeRemembered(rawBody) });
  return res;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'logout') return logout(req);

  const rawBody = await req.text();
  if (action === 'accept-invite') return acceptInvite(rawBody);

  const passthroughPath = PASSTHROUGH_TARGETS[action];
  if (passthroughPath) {
    const apiRes = await forward(passthroughPath, rawBody);
    return apiRes ? passthrough(apiRes) : unreachable();
  }

  const sessionPath = SESSION_TARGETS[action];
  if (sessionPath) return signIn(sessionPath, rawBody);

  return NextResponse.json(errorBody('NOT_FOUND', 'Not found.'), { status: 404 });
}

/**
 * GET /api/session/expired — where Server Components send the browser when the API rejects
 * the session (user removed, token revoked). Clearing the cookies here is what stops
 * /login → (proxy sees a cookie) → /app → 401 → /login from looping forever.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== 'expired') {
    return NextResponse.json(errorBody('NOT_FOUND', 'Not found.'), { status: 404 });
  }
  const res = NextResponse.redirect(new URL('/login', req.url));
  clearSessionCookies(res.cookies);
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
