import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { AppError } from '../errors/app-error.js';
import { ENV, type Env } from '../../config/env.js';
import type { FileStorage } from './file-storage.js';

const KEY_REGEX = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|zip)$/i;

@Injectable()
export class S3Storage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ENV) env: Env, s3Client?: S3Client) {
    if (!env.S3_BUCKET) {
      throw new Error('S3_BUCKET is required when using S3Storage');
    }
    this.bucket = env.S3_BUCKET;

    if (s3Client) {
      this.client = s3Client;
    } else {
      this.client = new S3Client({
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION || 'auto',
        credentials:
          env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
        forcePathStyle: true,
      });
    }
  }

  validateKey(key: string): void {
    if (!KEY_REGEX.test(key) || key.includes('..')) {
      throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid storage key');
    }
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.validateKey(key);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ServerSideEncryption: 'AES256',
        }),
      );
    } catch (err: any) {
      if (
        err?.name === 'UnsupportedAlgorithmException' ||
        err?.name === 'InvalidArgument' ||
        err?.message?.includes('ServerSideEncryption')
      ) {
        // Fall back without ServerSideEncryption for providers like MinIO/R2 that may reject it
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: bytes,
          }),
        );
      } else {
        throw err;
      }
    }
  }

  async stream(key: string): Promise<Readable> {
    this.validateKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new AppError(404, 'NOT_FOUND', 'File not found');
      }

      if (typeof (response.Body as any).pipe === 'function') {
        return response.Body as Readable;
      }
      return Readable.fromWeb(response.Body as any);
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      if (
        err?.name === 'NoSuchKey' ||
        err?.name === 'NotFound' ||
        err?.Code === 'NoSuchKey' ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError(404, 'NOT_FOUND', 'File not found');
      }
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    this.validateKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
