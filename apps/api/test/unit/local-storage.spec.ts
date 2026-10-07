import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { LocalStorage } from '../../src/common/storage/local.storage.js';
import { AppError } from '../../src/common/errors/app-error.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('LocalStorage', () => {
  let tmpDir: string;
  let storage: LocalStorage;
  const companyId = '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f';
  const reportId = '1f6d2e4b-9a1c-5d5f-0e2f-3b4c5d6e7f8a';
  const validKey = `${companyId}/${reportId}.pdf`;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'wt-storage-'));
    storage = new LocalStorage(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('puts and streams same bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await storage.put(validKey, bytes);
    const stream = await storage.stream(validKey);
    const result = await streamToBuffer(stream);
    expect(new Uint8Array(result)).toEqual(bytes);
  });

  it('removes and then stream returns 404', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.put(validKey, bytes);
    await storage.remove(validKey);
    await expect(storage.stream(validKey)).rejects.toThrow(AppError);
    await expect(storage.stream(validKey)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses invalid keys', async () => {
    const bytes = new Uint8Array([1]);
    for (const badKey of ['../x.pdf', 'a/b/c.pdf', '/etc/passwd', 'abc/def.pdf']) {
      await expect(storage.put(badKey, bytes)).rejects.toThrow();
      await expect(storage.stream(badKey)).rejects.toThrow();
      await expect(storage.remove(badKey)).rejects.toThrow();
    }
  });

  it('is located in storage dir and not public', async () => {
    expect(storage.resolvePath(validKey).startsWith(path.resolve(tmpDir))).toBe(true);
    expect(storage.resolvePath(validKey)).not.toContain('public');
  });
});
