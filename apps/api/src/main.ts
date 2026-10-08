import './instrument.js';
import 'dotenv/config';
import { createApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';

async function main() {
  const app = await createApp();
  await app.listen(loadEnv().PORT);
}

void main();
