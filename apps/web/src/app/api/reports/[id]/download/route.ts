import { cookies } from 'next/headers';
import { apiUrl } from '@/lib/api-url';

/** Streams a protected PDF from the API using the httpOnly session token; the browser never sees the token. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get('wt_at')?.value;
  if (!token) return new Response('Please sign in again.', { status: 401 });

  const res = await fetch(apiUrl(`/reports/${encodeURIComponent(id)}/download`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return new Response(body?.error?.message ?? 'Download failed.', {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'private, no-store',
    },
  });
}
