import type { ApiErrorBody } from '@worktrail/types';

export type SubmitResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string> };

/** POSTs JSON and normalises the API error envelope (or a network failure) into one shape. */
export async function submitJson<T>(url: string, body: unknown): Promise<SubmitResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const err = (json as ApiErrorBody | null)?.error;
    return {
      ok: false,
      message: err?.message ?? 'Something went wrong. Try again.',
      fields: (err?.details?.fields as Record<string, string> | undefined) ?? {},
    };
  } catch {
    return {
      ok: false,
      message: 'You appear to be offline. Check your connection and try again.',
      fields: {},
    };
  }
}
