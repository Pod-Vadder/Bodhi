import { jsonb, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './common';

export const audit = pgSchema('audit');

export const auditLog = audit.table('audit_log', {
  id: pk(),
  actorId: uuid('actor_id'),
  action: varchar('action', { length: 128 }).notNull(),
  entity: varchar('entity', { length: 128 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }),
  before: jsonb('before'),
  after: jsonb('after'),
  ip: varchar('ip', { length: 64 }),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
