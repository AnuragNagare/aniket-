import { describe, beforeEach, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3Storage } from '../../src/common/storage/s3.storage.js';
import { AppError } from '../../src/common/errors/app-error.js';
import type { Env } from '../../src/config/env.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('S3Storage', () => {
  const s3Mock = mockClient(S3Client);
  const companyId = '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f';
  const reportId = '1f6d2e4b-9a1c-5d5f-0e2f-3b4c5d6e7f8a';
  const validKey = `${companyId}/${reportId}.pdf`;

  const dummyEnv = {
    S3_BUCKET: 'test-bucket',
    S3_ENDPOINT: 'https://s3.example.com',
    S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
  } as unknown as Env;

  let storage: S3Storage;

  beforeEach(() => {
    s3Mock.reset();
    storage = new S3Storage(dummyEnv);
  });

  it('puts object with bucket, key, bytes, and AES256 server side encryption', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await storage.put(validKey, bytes);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: validKey,
      Body: bytes,
      ServerSideEncryption: 'AES256',
    });
  });

  it('streams object using GetObjectCommand', async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5]);
    s3Mock.on(GetObjectCommand).resolves({
      Body: Readable.from([bytes]) as any,
    });

    const stream = await storage.stream(validKey);
    const result = await streamToBuffer(stream);

    expect(result).toEqual(bytes);
    const calls = s3Mock.commandCalls(GetObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: validKey,
    });
  });

  it('maps NoSuchKey / 404 to AppError with status 404', async () => {
    s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({ message: 'The specified key does not exist.', $metadata: {} }));

    await expect(storage.stream(validKey)).rejects.toThrow(AppError);
    await expect(storage.stream(validKey)).rejects.toMatchObject({
      status: 404,
      response: {
        error: { code: 'NOT_FOUND' },
      },
    });
  });

  it('removes object using DeleteObjectCommand', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});

    await storage.remove(validKey);

    const calls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: validKey,
    });
  });

  it('refuses invalid keys matching LocalStorage validation', async () => {
    const bytes = new Uint8Array([1]);
    for (const badKey of ['../x.pdf', 'a/b/c.pdf', '/etc/passwd', 'abc/def.pdf']) {
      await expect(storage.put(badKey, bytes)).rejects.toThrow(AppError);
      await expect(storage.put(badKey, bytes)).rejects.toMatchObject({
        status: 400,
        response: {
          error: { code: 'INVALID_STORAGE_KEY' },
        },
      });
      await expect(storage.stream(badKey)).rejects.toThrow(AppError);
      await expect(storage.remove(badKey)).rejects.toThrow(AppError);
    }
  });

  it('throws error when S3_BUCKET is missing', () => {
    expect(() => new S3Storage({} as any)).toThrow('S3_BUCKET is required');
  });
});
