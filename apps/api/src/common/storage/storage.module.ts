import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { FILE_STORAGE } from './file-storage.js';
import { LocalStorage } from './local.storage.js';
import { S3Storage } from './s3.storage.js';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: (env: Env) =>
        env.STORAGE_DRIVER === 's3' ? new S3Storage(env) : new LocalStorage(env.REPORT_STORAGE_DIR),
      inject: [ENV],
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
