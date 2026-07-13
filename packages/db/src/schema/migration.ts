import {
  bigint,
  jsonb,
  pgSchema,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk } from './common';

export const migration = pgSchema('migration');

/** Legacy PK -> new UUID mapping, one row per migrated entity instance (phases M1-M5). */
export const idMap = migration.table(
  'id_map',
  {
    id: pk(),
    entity: varchar('entity', { length: 128 }).notNull(),
    legacyId: bigint('legacy_id', { mode: 'number' }).notNull(),
    newId: uuid('new_id').notNull(),
    migratedAt: timestamp('migrated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('id_map_entity_legacy_ux').on(t.entity, t.legacyId)],
);

export const runLog = migration.table('run_log', {
  id: pk(),
  runId: varchar('run_id', { length: 64 }).notNull(),
  phase: varchar('phase', { length: 16 }).notNull(),
  entity: varchar('entity', { length: 128 }),
  status: varchar('status', { length: 32 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  /** Row counts, reconciliation totals, and error samples for the run. */
  detail: jsonb('detail'),
});
