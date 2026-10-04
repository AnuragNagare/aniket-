import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/session/[action]/route';

const tokens = {
  accessToken: 'at.jwt',
  refreshToken: '11111111-1111-1111-1111-111111111111.secret',
  user: { id: 'u1', role: 'OWNER', companyId: 'c1', name: 'Rahul', email: 'r@a.in' },
};

function call(action: string, body: unknown = {}, cookies: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost:3000/api/session/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
  return POST(req, { params: Promise.resolve({ action }) });
}

afterEach(() => vi.restoreAllMocks());

describe('session route', () => {
  it('login sets httpOnly cookies and keeps tokens out of the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(tokens));
    const res = await call('login', { email: 'r@a.in', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/login$/),
      expect.any(Object),
    );
    expect(await res.json()).toEqual({ user: tokens.user });
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/wt_at=at\.jwt;.*HttpOnly/i);
    expect(cookies).toMatch(/wt_rt=11111111-1111-1111-1111-111111111111\.secret;.*HttpOnly/i);
  });

  it('signup forwards to /auth/signup/admin', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(tokens, { status: 201 }));
    await call('signup');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/signup\/admin$/),
      expect.any(Object),
    );
  });

  it('passes API errors through unchanged and sets no cookies', async () => {
    const err = {
      error: {
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists. Sign in instead.',
        details: {},
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(err, { status: 409 }));
    const res = await call('signup');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(err);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns a readable error when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await call('login');
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('API_UNREACHABLE');
  });

  it('logout revokes the refresh token and clears both cookies', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const res = await call('logout', {}, { wt_rt: 'rt-1', wt_at: 'at-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ refreshToken: 'rt-1' });
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/wt_at=;/);
    expect(cookies).toMatch(/wt_rt=;/);
  });

  it('unknown action is 404', async () => {
    expect((await call('nope')).status).toBe(404);
  });
});
