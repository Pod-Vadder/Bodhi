import { defineConfig } from 'drizzle-kit';

// Paths are relative to the repo root: drizzle-kit resolves from the CWD of the
// invoking script (`npm run db:generate`), not from this config file.
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema/index.ts',
  out: './packages/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://bodhi:bodhi@localhost:5432/bodhi',
  },
});
