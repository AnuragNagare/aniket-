import { backoffMs, groupBySession, type OutboxRow } from '../src/tracking/outbox';
import { MemoryOutbox } from './fakes/memory-outbox';

const row = (id: string, sessionId: string, capturedAt: string, nextAttemptAt = 0): OutboxRow => ({
  clientPointId: id,
  sessionId,
  payload: { clientPointId: id, latitude: 19, longitude: 72, capturedAt },
  attempts: 0,
  nextAttemptAt,
});

describe('outbox', () => {
  it('backs off 30 s, doubling, capped at 30 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(20)).toBe(30 * 60_000);
  });

  it('groups rows by session, keeping time order', () => {
    const g = groupBySession([row('a', 's1', '2026-10-06T04:00:00Z'), row('b', 's2', '2026-10-06T04:01:00Z'), row('c', 's1', '2026-10-06T04:02:00Z')]);
    expect([...g.entries()].map(([s, rows]) => [s, rows.map((r) => r.clientPointId)])).toEqual([['s1', ['a', 'c']], ['s2', ['b']]]);
  });

  it('storage: ignores duplicate ids, returns due rows oldest first, honours nextAttemptAt', async () => {
    const box = new MemoryOutbox();
    await box.insert([row('b', 's', '2026-10-06T04:05:00Z'), row('a', 's', '2026-10-06T04:00:00Z'), row('later', 's', '2026-10-06T04:10:00Z', 10_000)]);
    await box.insert([row('a', 's', '2026-10-06T04:00:00Z')]);
    expect(await box.count()).toBe(3);
    expect((await box.due(5_000, 10)).map((r) => r.clientPointId)).toEqual(['a', 'b']);
    await box.remove(['a']);
    expect(await box.count()).toBe(2);
  });

  it('storage: meta values round-trip and clear', async () => {
    const box = new MemoryOutbox();
    await box.setMeta('trackingSessionId', 's1');
    expect(await box.getMeta('trackingSessionId')).toBe('s1');
    await box.setMeta('trackingSessionId', null);
    expect(await box.getMeta('trackingSessionId')).toBeNull();
  });
});
