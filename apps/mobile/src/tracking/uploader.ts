import type { CreateUpdateResponse, LocationBatchResponse } from '@worktrail/types';
import { api, ApiError } from '../api';
import { backoffMs, groupBySession, type OutboxRow } from './outbox';
import { clearPendingEnd, readPendingEnd } from './pending-end';
import { getOutbox, getUpdateQueue } from './store';

const BATCH_SIZE = 50;
const SCAN_LIMIT = BATCH_SIZE * 4;

export type FlushResult = { sent: number; dropped: number; pending: number; stopped: 'DONE' | 'OFFLINE' | 'SIGNED_OUT' };

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** A server answer that means "this batch will never succeed": stop retrying it. */
const isPermanent = (e: unknown) => e instanceof ApiError && (e.status === 400 || e.status === 403 || e.status === 404);

export async function flushOutbox(now: () => number = Date.now): Promise<FlushResult> {
  const box = await getOutbox();
  let sent = 0;
  let dropped = 0;

  for (;;) {
    const due = await box.due(now(), SCAN_LIMIT);
    if (due.length === 0) break;
    for (const [sessionId, rows] of groupBySession(due)) {
      for (const chunk of chunks(rows, BATCH_SIZE)) {
        const ids = chunk.map((r) => r.clientPointId);
        try {
          const res = await api.request<LocationBatchResponse>(
            'POST',
            '/locations/batch',
            { sessionId, points: chunk.map((r) => r.payload) },
            { headers: { 'idempotency-key': `${ids[0]}:${ids.length}` } },
          );
          // Accepted, duplicate and rejected points are all finished with.
          await box.remove(ids);
          sent += ids.length - res.rejected.length;
          dropped += res.rejected.length;
          await box.setMeta('lastSentAt', new Date(now()).toISOString());
        } catch (e) {
          if (isPermanent(e)) {
            await box.remove(ids);
            dropped += ids.length;
            continue;
          }
          if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
            return { sent, dropped, pending: await box.count(), stopped: 'SIGNED_OUT' };
          }
          await box.update(chunk.map((r: OutboxRow) => ({
            clientPointId: r.clientPointId,
            attempts: r.attempts + 1,
            nextAttemptAt: now() + backoffMs(r.attempts + 1),
          })));
          return { sent, dropped, pending: await box.count(), stopped: 'OFFLINE' };
        }
      }
    }
  }
  return { sent, dropped, pending: await box.count(), stopped: 'DONE' };
}

export async function flushUpdates(now: () => number = Date.now): Promise<FlushResult> {
  const queue = await getUpdateQueue();
  let sent = 0;
  let dropped = 0;
  for (;;) {
    const due = await queue.due(now(), 20);
    if (due.length === 0) break;
    for (const item of due) {
      try {
        await api.request<CreateUpdateResponse>('POST', '/updates', item.payload);
        await queue.remove(item.clientUpdateId);
        sent += 1;
      } catch (e) {
        if (isPermanent(e) || (e instanceof ApiError && e.status === 409)) {
          await queue.remove(item.clientUpdateId);
          dropped += 1;
          continue;
        }
        if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
          return { sent, dropped, pending: await queue.count(), stopped: 'SIGNED_OUT' };
        }
        await queue.update({
          clientUpdateId: item.clientUpdateId,
          attempts: item.attempts + 1,
          nextAttemptAt: now() + backoffMs(item.attempts + 1),
        });
        return { sent, dropped, pending: await queue.count(), stopped: 'OFFLINE' };
      }
    }
  }
  return { sent, dropped, pending: await queue.count(), stopped: 'DONE' };
}

export async function flushPendingEnd(): Promise<'none' | 'sent' | 'kept'> {
  const pending = await readPendingEnd();
  if (!pending) return 'none';
  try {
    await api.request('POST', `/sessions/${pending.sessionId}/end`, pending.body);
  } catch (e) {
    const alreadyEnded = e instanceof ApiError && (e.code === 'SESSION_NOT_ACTIVE' || e.status === 404);
    if (!alreadyEnded) return 'kept';
  }
  await clearPendingEnd();
  return 'sent';
}

let running: Promise<void> | null = null;

/** Uploads queued points, updates, then any queued End work. Concurrent callers share one run. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    try {
      await flushOutbox();
      await flushUpdates();
      await flushPendingEnd();
    } finally {
      running = null;
    }
  })();
  return running;
}
