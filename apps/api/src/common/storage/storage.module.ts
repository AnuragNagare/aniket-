import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { FILE_STORAGE } from './file-storage.js';
import { LocalStorage } from './local.storage.js';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: (env: Env) => new LocalStorage(env.REPORT_STORAGE_DIR),
      inject: [ENV],
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
