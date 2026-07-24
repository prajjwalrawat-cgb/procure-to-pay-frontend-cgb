import { defineConfig } from 'vitest/config';

// Unit tests only; Playwright e2e in ./e2e runs via `pnpm test:e2e`.
export default defineConfig({
  test: {
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'node',
  },
});
