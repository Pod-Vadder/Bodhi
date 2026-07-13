import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';
import { candidates } from './candidate';
import { questionOptions, questions, questionSets } from './questionBank';

export const assessment = pgSchema('assessment');

export const attemptStatus = assessment.enum('attempt_status', [
  'not_started',
  'in_progress',
  'submitted',
  'expired',
  'locked',
]);

export const assessments = assessment.table('assessments', {
  id: pk(),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  description: varchar('description', { length: 2000 }),
  isActive: boolean('is_active').notNull().default(true),
  ...legacyColumns,
  ...timestamps,
});

/** BR-13: modules are served strictly in sequence with per-module time limits. */
export const assessmentModules = assessment.table('assessment_modules', {
  id: pk(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  questionSetId: uuid('question_set_id')
    .notNull()
    .references(() => questionSets.id),
  sequence: integer('sequence').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  randomizeQuestions: boolean('randomize_questions').notNull().default(true),
  ...legacyColumns,
  ...timestamps,
});

export const attempts = assessment.table(
  'attempts',
  {
    id: pk(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id),
    /** BR-12: locked after MAX_ATTEMPTS_PER_ASSESSMENT (default 3). */
    attemptNumber: integer('attempt_number').notNull(),
    status: attemptStatus('status').notNull().default('not_started'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    /** Server-authoritative deadline; the client clock is never trusted. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    ...legacyColumns,
    ...timestamps,
  },
  (t) => [uniqueIndex('attempts_candidate_assessment_no_ux').on(t.candidateId, t.assessmentId, t.attemptNumber)],
);

export const responses = assessment.table(
  'responses',
  {
    id: pk(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    optionId: uuid('option_id').references(() => questionOptions.id),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    ...legacyColumns,
    ...timestamps,
  },
  (t) => [uniqueIndex('responses_attempt_question_ux').on(t.attemptId, t.questionId)],
);

export const scores = assessment.table('scores', {
  id: pk(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  /** aptitude | interest | personality | csr */
  domain: varchar('domain', { length: 32 }).notNull(),
  scaleCode: varchar('scale_code', { length: 32 }).notNull(),
  raw: numeric('raw', { precision: 12, scale: 4 }),
  derived: numeric('derived', { precision: 12, scale: 4 }),
  classification: varchar('classification', { length: 8 }),
  /** Full engine output for the scale (fits, corrections, ranks) for auditability. */
  detail: jsonb('detail'),
  engineVersion: varchar('engine_version', { length: 32 }),
  ...timestamps,
});

export const reports = assessment.table('reports', {
  id: pk(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id'),
  templateCode: varchar('template_code', { length: 64 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  ...legacyColumns,
  ...timestamps,
});
