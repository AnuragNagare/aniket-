import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApiErrorBody } from '@worktrail/types';
import { apiUrl } from './api-url';
import { ACCESS_COOKIE } from './session';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(body?.error.message ?? `API ${status}`);
  }
}

/** Authenticated GET from a Server Component. Missing or rejected session → sign-in. */
export async function serverApi<T>(path: string): Promise<T> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) redirect('/api/session/expired');

  const res = await fetch(apiUrl(path), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  // The API rejected the session: clear the cookies on the way out, or the proxy loops.
  if (res.status === 401) redirect('/api/session/expired');
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}
