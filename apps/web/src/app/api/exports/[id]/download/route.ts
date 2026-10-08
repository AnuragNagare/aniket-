import { cookies } from 'next/headers';
import { apiUrl } from '@/lib/api-url';

/** Streams a protected data export ZIP from the API using httpOnly session cookie. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get('wt_at')?.value;
  if (!token) return new Response('Please sign in again.', { status: 401 });

  const res = await fetch(apiUrl(`/exports/${encodeURIComponent(id)}/download`), {
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
      'Content-Type': 'application/zip',
      'Content-Disposition': res.headers.get('content-disposition') ?? `attachment; filename="worktrail-export-${id}.zip"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
