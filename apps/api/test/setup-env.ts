import { config } from 'dotenv';
import { resolve } from 'node:path';

// e2e suites run against the dedicated test database, never the dev one.
config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
