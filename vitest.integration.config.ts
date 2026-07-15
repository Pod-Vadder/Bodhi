import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const pkg = (name: string) => path.resolve(root, `packages/${name}/src/index.ts`);

/**
 * Integration suite: requires live Postgres + Redis (docker compose up -d
 * postgres redis). Run via `npm run test:integration`; CI provides the
 * services in a dedicated job.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@bodhi/shared-types': pkg('shared-types'),
      '@bodhi/shared-config': pkg('shared-config'),
      '@bodhi/shared-validators': pkg('shared-validators'),
      '@bodhi/scoring-engine': pkg('scoring-engine'),
      '@bodhi/db': pkg('db'),
    },
  },
  test: {
    include: ['services/**/test-integration/**/*.test.ts', 'db/**/test-integration/**/*.test.ts'],
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
