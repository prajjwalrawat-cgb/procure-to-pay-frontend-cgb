import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests only; Playwright e2e in ./e2e runs via `pnpm test:e2e`.
export default defineConfig({
  // Mirrors the `@/*` path alias in tsconfig.json, so a module under test can
  // be imported here exactly as the app imports it (middleware.ts, for one,
  // reaches its cookie names through `@/lib/env`).
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'node',
  },
});
