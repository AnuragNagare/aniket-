import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApiErrorBody } from '@worktrail/types';
import { apiUrl } from './api-url';
import type { MutationResult } from './mutation-result';
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

/** Authenticated POST from a Server Action. API errors come back as data so forms can show them. */
export async function serverMutate<T>(path: string, body: unknown = {}): Promise<MutationResult<T>> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) redirect('/api/session/expired');

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      message: 'Work Trail is not reachable right now. Try again in a moment.',
      fields: {},
    };
  }
  if (res.status === 401) redirect('/api/session/expired');

  const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: json as T };
  const err = (json as ApiErrorBody | null)?.error;
  return {
    ok: false,
    message: err?.message ?? 'Something went wrong. Try again.',
    fields: (err?.details?.fields as Record<string, string> | undefined) ?? {},
  };
}
