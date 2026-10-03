// Runs a command with the monorepo's root .env loaded. `--test` points DATABASE_URL at
// TEST_DATABASE_URL so migrations can target the test database. Cross-platform, unlike
// `VAR=value cmd` in package.json scripts on Windows.
//   node scripts/with-env.mjs [--test] <command> [...args]
import { spawnSync } from 'node:child_process';
import { delimiter, resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
// Make local CLIs (prisma, nest, tsx) resolvable when run outside `pnpm run`.
process.env.PATH = `${resolve(import.meta.dirname, '../node_modules/.bin')}${delimiter}${process.env.PATH}`;

const args = process.argv.slice(2);
if (args[0] === '--test') {
  args.shift();
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (args.length === 0) {
  console.error('Usage: node scripts/with-env.mjs [--test] <command> [...args]');
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
