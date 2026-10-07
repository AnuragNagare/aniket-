import { Injectable } from '@nestjs/common';
import fs from 'node:fs';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import type { FileStorage } from './file-storage.js';

const KEY_REGEX = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i;

@Injectable()
export class LocalStorage implements FileStorage {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  validateKey(key: string): void {
    if (!KEY_REGEX.test(key) || key.includes('..')) {
      throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid storage key');
    }
  }

  resolvePath(key: string): string {
    this.validateKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const fullPath = this.resolvePath(key);
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });

    const tempPath = path.join(dir, `.tmp-${randomUUID()}.pdf`);
    await writeFile(tempPath, bytes);
    await rename(tempPath, fullPath);
  }

  async stream(key: string): Promise<Readable> {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, 'NOT_FOUND', 'File not found');
    }
    return fs.createReadStream(fullPath);
  }

  async remove(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    try {
      await unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}
