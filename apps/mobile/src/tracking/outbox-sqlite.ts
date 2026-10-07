import * as SQLite from 'expo-sqlite';
import type { MetaKey, OutboxRow, OutboxStorage, QueuedUpdate, UpdateQueueStorage } from './outbox';

type DbPointRow = {
  client_point_id: string;
  session_id: string;
  payload: string;
  attempts: number;
  next_attempt_at: number;
};

type DbUpdateRow = {
  client_update_id: string;
  submitted_at: string;
  payload: string;
  attempts: number;
  next_attempt_at: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('worktrail.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS outbox_points (
          client_point_id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS outbox_due ON outbox_points (next_attempt_at, captured_at);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox_updates (
          client_update_id TEXT PRIMARY KEY NOT NULL,
          submitted_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL DEFAULT 0
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export function openSqliteUpdateQueue(db: SQLite.SQLiteDatabase): UpdateQueueStorage {
  const toUpdate = (r: DbUpdateRow): QueuedUpdate => ({
    clientUpdateId: r.client_update_id,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
  });

  return {
    async add(u) {
      await db.runAsync(
        'INSERT OR IGNORE INTO outbox_updates (client_update_id, submitted_at, payload, attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?)',
        u.clientUpdateId,
        u.payload.submittedAt,
        JSON.stringify(u.payload),
        u.attempts,
        u.nextAttemptAt,
      );
    },
    async due(now, limit) {
      const rows = await db.getAllAsync<DbUpdateRow>(
        'SELECT client_update_id, submitted_at, payload, attempts, next_attempt_at FROM outbox_updates WHERE next_attempt_at <= ? ORDER BY submitted_at LIMIT ?',
        now,
        limit,
      );
      return rows.map(toUpdate);
    },
    async list() {
      const rows = await db.getAllAsync<DbUpdateRow>(
        'SELECT client_update_id, submitted_at, payload, attempts, next_attempt_at FROM outbox_updates ORDER BY submitted_at DESC',
      );
      return rows.map(toUpdate);
    },
    async update(u) {
      await db.runAsync(
        'UPDATE outbox_updates SET attempts = ?, next_attempt_at = ? WHERE client_update_id = ?',
        u.attempts,
        u.nextAttemptAt,
        u.clientUpdateId,
      );
    },
    async remove(clientUpdateId) {
      await db.runAsync('DELETE FROM outbox_updates WHERE client_update_id = ?', clientUpdateId);
    },
    async count() {
      return (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox_updates'))?.n ?? 0;
    },
    async clear() {
      await db.runAsync('DELETE FROM outbox_updates');
    },
  };
}

export async function openSqliteOutbox(customDb?: SQLite.SQLiteDatabase): Promise<OutboxStorage> {
  const db = customDb ?? (await openDb());

  const toRow = (r: DbPointRow): OutboxRow => ({
    clientPointId: r.client_point_id,
    sessionId: r.session_id,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
  });

  return {
    async insert(rows) {
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync(
            'INSERT OR IGNORE INTO outbox_points (client_point_id, session_id, captured_at, payload, attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)',
            r.clientPointId,
            r.sessionId,
            r.payload.capturedAt,
            JSON.stringify(r.payload),
            r.attempts,
            r.nextAttemptAt,
          );
        }
      });
    },
    async due(now, limit) {
      const rows = await db.getAllAsync<DbPointRow>(
        'SELECT client_point_id, session_id, payload, attempts, next_attempt_at FROM outbox_points WHERE next_attempt_at <= ? ORDER BY captured_at LIMIT ?',
        now,
        limit,
      );
      return rows.map(toRow);
    },
    async update(rows) {
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync(
            'UPDATE outbox_points SET attempts = ?, next_attempt_at = ? WHERE client_point_id = ?',
            r.attempts,
            r.nextAttemptAt,
            r.clientPointId,
          );
        }
      });
    },
    async remove(ids) {
      if (!ids.length) return;
      await db.runAsync(`DELETE FROM outbox_points WHERE client_point_id IN (${ids.map(() => '?').join(',')})`, ...ids);
    },
    async count() {
      return (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox_points'))?.n ?? 0;
    },
    async clear() {
      await db.execAsync('DELETE FROM outbox_points; DELETE FROM meta;');
    },
    async getMeta(key: MetaKey) {
      return (await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key))?.value ?? null;
    },
    async setMeta(key: MetaKey, value: string | null) {
      if (value === null) await db.runAsync('DELETE FROM meta WHERE key = ?', key);
      else await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    },
  };
}
