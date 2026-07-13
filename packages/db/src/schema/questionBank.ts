import { boolean, integer, jsonb, pgSchema, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';

export const questionBank = pgSchema('question_bank');

export const questionSets = questionBank.table('question_sets', {
  id: pk(),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  /** aptitude | interest | personality | demographic */
  kind: varchar('kind', { length: 32 }).notNull(),
  /** Scoring scale this set feeds (e.g. WS1, I001, EI dichotomy). */
  scaleCode: varchar('scale_code', { length: 32 }),
  isActive: boolean('is_active').notNull().default(true),
  ...legacyColumns,
  ...timestamps,
});

export const questions = questionBank.table('questions', {
  id: pk(),
  questionSetId: uuid('question_set_id')
    .notNull()
    .references(() => questionSets.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  /** Free-form metadata carried over from legacy columns that have no first-class home yet. */
  meta: jsonb('meta'),
  isActive: boolean('is_active').notNull().default(true),
  ...legacyColumns,
  ...timestamps,
});

export const questionOptions = questionBank.table('question_options', {
  id: pk(),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  /** Numeric contribution to the owning scale (or MBTI pole letter in `pole`). */
  value: integer('value').notNull().default(0),
  pole: varchar('pole', { length: 1 }),
  orderIndex: integer('order_index').notNull().default(0),
  ...legacyColumns,
  ...timestamps,
});
