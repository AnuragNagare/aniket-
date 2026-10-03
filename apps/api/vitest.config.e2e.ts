import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

// SWC keeps decorator metadata, which Nest needs for constructor injection.
export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // Suites share one Postgres test database, so run files one at a time.
    fileParallelism: false,
  },
});
