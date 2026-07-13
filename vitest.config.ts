import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const pkg = (name: string) => path.resolve(root, `packages/${name}/src/index.ts`);

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
    include: ['packages/**/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/scoring-engine/src/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
