import { integer, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';
import { candidates } from './candidate';
import { users } from './core';

export const counseling = pgSchema('counseling');

export const bookingStatus = counseling.enum('booking_status', [
  'requested',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export const counselors = counseling.table('counselors', {
  id: pk(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: varchar('bio', { length: 2000 }),
  specialization: varchar('specialization', { length: 300 }),
  ...legacyColumns,
  ...timestamps,
});

export const availabilitySlots = counseling.table('availability_slots', {
  id: pk(),
  counselorId: uuid('counselor_id')
    .notNull()
    .references(() => counselors.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(45),
  capacity: integer('capacity').notNull().default(1),
  ...legacyColumns,
  ...timestamps,
});

export const bookings = counseling.table('bookings', {
  id: pk(),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => availabilitySlots.id),
  candidateId: uuid('candidate_id')
    .notNull()
    .references(() => candidates.id),
  status: bookingStatus('status').notNull().default('requested'),
  notes: varchar('notes', { length: 2000 }),
  ...legacyColumns,
  ...timestamps,
});
