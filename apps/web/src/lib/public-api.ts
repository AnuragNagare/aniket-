import 'server-only';
import { apiUrl } from './api-url';

export type PublicResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** Unauthenticated GET from a Server Component (e.g. the invite preview). 503 = unreachable. */
export async function publicGet<T>(path: string): Promise<PublicResult<T>> {
  try {
    const res = await fetch(apiUrl(path), { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 503 };
  }
}
