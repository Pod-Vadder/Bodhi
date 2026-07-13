import { bigint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export const pk = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

/** ETL traceability back to the legacy SQL Server rows (see migration.id_map). */
export const legacyColumns = {
  legacyId: bigint('legacy_id', { mode: 'number' }),
  legacySource: varchar('legacy_source', { length: 128 }),
};

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
