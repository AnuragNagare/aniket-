import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  stream(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}
