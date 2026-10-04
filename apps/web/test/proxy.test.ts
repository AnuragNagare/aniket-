import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function req(path: string, cookies: Record<string, string> = {}) {
  const r = new NextRequest(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

afterEach(() => vi.restoreAllMocks());

describe('proxy', () => {
  it('sends anonymous users from /app to /login', async () => {
    const res = await proxy(req('/app/dashboard'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets a valid access cookie through', async () => {
    const res = await proxy(req('/app/dashboard', { wt_at: 'a' }));
    expect(res.headers.get('location')).toBeNull();
  });

  it('silently refreshes when only the refresh cookie remains', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ accessToken: 'new-at', refreshToken: 'new-rt', user: {} }),
    );
    const res = await proxy(req('/app/dashboard', { wt_rt: 'old-rt' }));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.getSetCookie().join('\n')).toMatch(/wt_at=new-at/);
    // The refreshed cookie is forwarded to this same request, so Server Components see it.
    expect(res.headers.get('x-middleware-request-cookie')).toContain('wt_at=new-at');
  });

  it('clears cookies and redirects when refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: {} }, { status: 401 }));
    const res = await proxy(req('/app/dashboard', { wt_rt: 'revoked' }));
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.headers.getSetCookie().join('\n')).toMatch(/wt_rt=;/);
  });

  it('sends signed-in users away from /login', async () => {
    const res = await proxy(req('/login', { wt_at: 'a' }));
    expect(res.headers.get('location')).toBe('http://localhost:3000/app/dashboard');
  });

  it('lets anonymous users reach /signup', async () => {
    const res = await proxy(req('/signup'));
    expect(res.headers.get('location')).toBeNull();
  });
});
