import type { OutboxStorage, UpdateQueueStorage } from './outbox';
import { openDb, openSqliteOutbox, openSqliteUpdateQueue } from './outbox-sqlite';

let instance: Promise<OutboxStorage> | null = null;
let updates: Promise<UpdateQueueStorage> | null = null;

/** One outbox per process (the app and the headless background task each open their own). */
export function getOutbox(): Promise<OutboxStorage> {
  instance ??= openSqliteOutbox();
  return instance;
}

export function setOutboxForTests(storage: OutboxStorage | null) {
  instance = storage ? Promise.resolve(storage) : null;
}

export function getUpdateQueue(): Promise<UpdateQueueStorage> {
  updates ??= openDb().then(openSqliteUpdateQueue);
  return updates;
}

export function setUpdateQueueForTests(s: UpdateQueueStorage | null) {
  updates = s ? Promise.resolve(s) : null;
}
