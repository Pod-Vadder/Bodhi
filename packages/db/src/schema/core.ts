import { boolean, pgSchema, text, timestamp, uuid, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';

export const core = pgSchema('core');

export const userRole = core.enum('user_role', ['admin', 'ops', 'counselor', 'partner', 'candidate']);

export const users = core.table(
  'users',
  {
    id: pk(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('candidate'),
    fullName: varchar('full_name', { length: 200 }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...legacyColumns,
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_ux').on(t.email)],
);

export const organizations = core.table('organizations', {
  id: pk(),
  name: varchar('name', { length: 300 }).notNull(),
  kind: varchar('kind', { length: 50 }).notNull().default('school'),
  contactEmail: varchar('contact_email', { length: 320 }),
  contactPhone: varchar('contact_phone', { length: 32 }),
  ...legacyColumns,
  ...timestamps,
});

export const refreshTokens = core.table('refresh_tokens', {
  id: pk(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
});
