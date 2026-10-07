import { setUpdateQueueForTests, setOutboxForTests } from '../src/tracking/store';
import { flushUpdates } from '../src/tracking/uploader';
import { useAuthStore } from '../src/auth/auth-store';
import { MemoryOutbox, MemoryUpdateQueue } from './fakes/memory-outbox';
import type { QueuedUpdate } from '../src/tracking/outbox';

const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const queued = (id: string, submittedAt: string): QueuedUpdate => ({
  clientUpdateId: id,
  payload: { clientUpdateId: id, sessionId: 's1', text: 'Completed installation at site.', inputMethod: 'TYPED', submittedAt },
  attempts: 0,
  nextAttemptAt: 0,
});

let q: MemoryUpdateQueue;
beforeEach(() => {
  fetchMock.mockReset();
  q = new MemoryUpdateQueue();
  setUpdateQueueForTests(q);
  setOutboxForTests(new MemoryOutbox());
  useAuthStore.setState({ status: 'signedIn', accessToken: 'at' });
});

describe('update queue', () => {
  it('sends queued updates oldest first and removes them, including duplicates', async () => {
    await q.add(queued('b', '2026-10-06T06:05:00Z'));
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    fetchMock
      .mockReturnValueOnce(json({ update: {}, duplicate: false }, 201))
      .mockReturnValueOnce(json({ update: {}, duplicate: true }, 200));
    expect(await flushUpdates()).toMatchObject({ sent: 2, pending: 0, stopped: 'DONE' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).clientUpdateId).toBe('a');
  });

  it('keeps updates and backs off while offline', async () => {
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await flushUpdates(() => 1_000)).toMatchObject({ sent: 0, pending: 1, stopped: 'OFFLINE' });
    expect((await q.list())[0]).toMatchObject({ attempts: 1, nextAttemptAt: 31_000 });
  });

  it('drops an update the server will never accept, and keeps going', async () => {
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    await q.add(queued('b', '2026-10-06T06:05:00Z'));
    fetchMock
      .mockReturnValueOnce(json({ error: { code: 'SESSION_NOT_ACTIVE', message: 'Start work before adding an update.', details: {} } }, 409))
      .mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    expect(await flushUpdates()).toMatchObject({ sent: 1, dropped: 1, pending: 0 });
  });
});
