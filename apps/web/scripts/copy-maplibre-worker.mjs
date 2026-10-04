// MapLibre finds its web worker relative to its own file (import.meta.url), which the
// bundler relocates, so the worker 404s. Serve the worker (and the shared chunk it
// imports) from /public/maplibre instead, copied from the installed package so the
// version always matches. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/package.json')) + '/dist';
const out = resolve(import.meta.dirname, '../public/maplibre');

mkdirSync(out, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(`${dist}/${file}`, `${out}/${file}`);
}
console.log('Copied MapLibre worker to public/maplibre');
