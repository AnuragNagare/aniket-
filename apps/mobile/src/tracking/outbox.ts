import type { BatchPoint, CreateUpdateInput } from '@worktrail/types';

export type OutboxRow = {
  clientPointId: string;
  sessionId: string;
  payload: BatchPoint;
  attempts: number;
  /** Epoch ms; the row is not retried before this. */
  nextAttemptAt: number;
};

export type MetaKey =
  | 'trackingSessionId'
  | 'lastSentAt'
  | 'pendingEnd'
  | 'batteryTipShown'
  | 'askedBackground'
  | 'dictationLocale';

/** Points waiting to be uploaded, plus a few small tracking flags. Survives app restarts. */
export interface OutboxStorage {
  insert(rows: OutboxRow[]): Promise<void>;
  due(now: number, limit: number): Promise<OutboxRow[]>;
  update(rows: Array<Pick<OutboxRow, 'clientPointId' | 'attempts' | 'nextAttemptAt'>>): Promise<void>;
  remove(ids: string[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  getMeta(key: MetaKey): Promise<string | null>;
  setMeta(key: MetaKey, value: string | null): Promise<void>;
}

export type QueuedUpdate = {
  clientUpdateId: string;
  payload: CreateUpdateInput;
  attempts: number;
  nextAttemptAt: number;
};

/** Work updates written without signal, waiting to be sent. */
export interface UpdateQueueStorage {
  add(u: QueuedUpdate): Promise<void>;
  due(now: number, limit: number): Promise<QueuedUpdate[]>;
  list(): Promise<QueuedUpdate[]>;
  update(u: Pick<QueuedUpdate, 'clientUpdateId' | 'attempts' | 'nextAttemptAt'>): Promise<void>;
  remove(clientUpdateId: string): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

const BASE_MS = 30_000;
const MAX_MS = 30 * 60_000;

export const backoffMs = (attempts: number) => Math.min(BASE_MS * 2 ** Math.max(0, attempts - 1), MAX_MS);

export function groupBySession(rows: OutboxRow[]): Map<string, OutboxRow[]> {
  const groups = new Map<string, OutboxRow[]>();
  for (const r of rows) {
    const list = groups.get(r.sessionId) ?? [];
    list.push(r);
    groups.set(r.sessionId, list);
  }
  return groups;
}
