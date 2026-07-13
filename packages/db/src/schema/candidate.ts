import { date, pgSchema, uuid, varchar } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';
import { organizations, users } from './core';

export const candidate = pgSchema('candidate');

export const genderEnum = candidate.enum('gender', ['M', 'F', 'O']);

export const candidates = candidate.table('candidates', {
  id: pk(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id),
  dateOfBirth: date('date_of_birth').notNull(),
  gender: genderEnum('gender').notNull(),
  grade: varchar('grade', { length: 32 }),
  schoolName: varchar('school_name', { length: 300 }),
  city: varchar('city', { length: 120 }),
  guardianName: varchar('guardian_name', { length: 200 }),
  guardianPhone: varchar('guardian_phone', { length: 32 }),
  ...legacyColumns,
  ...timestamps,
});
