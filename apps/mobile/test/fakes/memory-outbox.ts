import type { MetaKey, OutboxRow, OutboxStorage, QueuedUpdate, UpdateQueueStorage } from '../../src/tracking/outbox';

export class MemoryOutbox implements OutboxStorage {
  rows = new Map<string, OutboxRow>();
  meta = new Map<MetaKey, string>();

  async insert(rows: OutboxRow[]) {
    for (const r of rows) if (!this.rows.has(r.clientPointId)) this.rows.set(r.clientPointId, { ...r });
  }
  async due(now: number, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.nextAttemptAt <= now)
      .sort((a, b) => a.payload.capturedAt.localeCompare(b.payload.capturedAt))
      .slice(0, limit);
  }
  async update(rows: Array<Pick<OutboxRow, 'clientPointId' | 'attempts' | 'nextAttemptAt'>>) {
    for (const r of rows) {
      const cur = this.rows.get(r.clientPointId);
      if (cur) this.rows.set(r.clientPointId, { ...cur, attempts: r.attempts, nextAttemptAt: r.nextAttemptAt });
    }
  }
  async remove(ids: string[]) {
    for (const id of ids) this.rows.delete(id);
  }
  async count() {
    return this.rows.size;
  }
  async clear() {
    this.rows.clear();
    this.meta.clear();
  }
  async getMeta(key: MetaKey) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: MetaKey, value: string | null) {
    if (value === null) this.meta.delete(key);
    else this.meta.set(key, value);
  }
}

export class MemoryUpdateQueue implements UpdateQueueStorage {
  items = new Map<string, QueuedUpdate>();
  async add(u: QueuedUpdate) {
    if (!this.items.has(u.clientUpdateId)) this.items.set(u.clientUpdateId, { ...u });
  }
  async due(now: number, limit: number) {
    return [...this.items.values()]
      .filter((u) => u.nextAttemptAt <= now)
      .sort((a, b) => a.payload.submittedAt.localeCompare(b.payload.submittedAt))
      .slice(0, limit);
  }
  async list() {
    return [...this.items.values()].sort((a, b) => b.payload.submittedAt.localeCompare(a.payload.submittedAt));
  }
  async update(u: Pick<QueuedUpdate, 'clientUpdateId' | 'attempts' | 'nextAttemptAt'>) {
    const cur = this.items.get(u.clientUpdateId);
    if (cur) this.items.set(u.clientUpdateId, { ...cur, ...u });
  }
  async remove(id: string) {
    this.items.delete(id);
  }
  async count() {
    return this.items.size;
  }
  async clear() {
    this.items.clear();
  }
}
