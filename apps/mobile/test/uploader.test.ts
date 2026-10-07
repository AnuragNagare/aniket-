import { setOutboxForTests, setUpdateQueueForTests } from '../src/tracking/store';
import { flushOutbox, flushPendingEnd, syncNow } from '../src/tracking/uploader';
import { savePendingEnd } from '../src/tracking/pending-end';
import { useAuthStore } from '../src/auth/auth-store';
import { MemoryOutbox, MemoryUpdateQueue } from './fakes/memory-outbox';
import type { OutboxRow } from '../src/tracking/outbox';

const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const okBatch = (accepted: number, rejected: string[] = []) =>
  json({
    accepted,
    duplicates: 0,
    rejected: rejected.map((id) => ({ clientPointId: id, reason: 'OUTSIDE_SESSION' })),
    lastLocationAt: null,
  });

const row = (i: number, sessionId = 's1'): OutboxRow => ({
  clientPointId: `p${String(i).padStart(3, '0')}`,
  sessionId,
  payload: {
    clientPointId: `p${String(i).padStart(3, '0')}`,
    latitude: 19,
    longitude: 72,
    capturedAt: new Date(Date.UTC(2026, 9, 6, 4, i)).toISOString(),
    source: 'BACKGROUND',
  },
  attempts: 0,
  nextAttemptAt: 0,
});

let box: MemoryOutbox;
beforeEach(() => {
  fetchMock.mockReset();
  box = new MemoryOutbox();
  setOutboxForTests(box);
  setUpdateQueueForTests(new MemoryUpdateQueue());
  useAuthStore.setState({ status: 'signedIn', accessToken: 'at' });
});

describe('uploader', () => {
  it('uploads in batches of 50, oldest first, and empties the queue', async () => {
    await box.insert(Array.from({ length: 120 }, (_, i) => row(i)));
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      okBatch(JSON.parse(String(init.body)).points.length),
    );
    const r = await flushOutbox();
    expect(r).toMatchObject({ sent: 120, pending: 0, stopped: 'DONE' });
    const sizes = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).points.length,
    );
    expect(sizes).toEqual([50, 50, 20]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).points[0].clientPointId).toBe('p000');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toHaveProperty('idempotency-key');
    expect(await box.getMeta('lastSentAt')).not.toBeNull();
  });

  it('keeps points and backs off when offline', async () => {
    await box.insert([row(1), row(2)]);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const r = await flushOutbox(() => 1_000);
    expect(r).toMatchObject({ sent: 0, pending: 2, stopped: 'OFFLINE' });
    expect([...box.rows.values()].map((x) => [x.attempts, x.nextAttemptAt])).toEqual([
      [1, 31_000],
      [1, 31_000],
    ]);
  });

  it('drops server-rejected points and points for a session that no longer exists', async () => {
    await box.insert([row(1), row(2), row(3, 'gone')]);
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      JSON.parse(String(init.body)).sessionId === 'gone'
        ? json({ error: { code: 'NOT_FOUND', message: 'Work session not found.', details: {} } }, 404)
        : okBatch(1, ['p001']),
    );
    const r = await flushOutbox();
    expect(r).toMatchObject({ sent: 1, dropped: 2, pending: 0 });
  });

  it('two simultaneous syncs upload each point once', async () => {
    await box.insert([row(1), row(2)]);
    fetchMock.mockImplementation(async (_u: string, init: RequestInit) => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(
        JSON.stringify({
          accepted: JSON.parse(String(init.body)).points.length,
          duplicates: 0,
          rejected: [],
          lastLocationAt: null,
        }),
      );
    });
    await Promise.all([syncNow(), syncNow()]);
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/locations/batch')),
    ).toHaveLength(1);
  });

  it('sends a queued End work and clears it; keeps it while offline', async () => {
    await savePendingEnd({
      sessionId: 's1',
      body: { deviceTime: '2026-10-06T12:00:00.000Z', endedAt: '2026-10-06T12:00:00.000Z' },
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await flushPendingEnd()).toBe('kept');
    fetchMock.mockReturnValueOnce(
      json({ session: {}, serverTime: '2026-10-06T12:30:00.000Z' }),
    );
    expect(await flushPendingEnd()).toBe('sent');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/sessions\/s1\/end$/);
    expect(await box.getMeta('pendingEnd')).toBeNull();
  });
});
