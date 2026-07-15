import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assessmentModules,
  assessments,
  candidates,
  createDb,
  questionOptions,
  questions,
  questionSets,
  runMigrations,
  users,
  type DbHandle,
} from '@bodhi/db';
import { AuthService } from '../src/auth/auth.service';
import { BcryptHasher } from '../src/auth/password';
import { TokenService } from '../src/auth/tokens';
import { FixedClock } from '../src/auth/memory-adapters';
import { InvalidRefreshTokenError } from '../src/auth/errors';
import {
  DrizzleAuditSink,
  DrizzleRefreshTokenStore,
  DrizzleUserRepo,
} from '../src/persistence/drizzle-auth';
import {
  DrizzleAssessmentRepo,
  DrizzleAttemptRepo,
  DrizzleModuleProgressRepo,
  DrizzleQuestionRepo,
  DrizzleResponseRepo,
} from '../src/persistence/drizzle-test-engine';
import { RedisTimerStore } from '../src/persistence/redis-timer-store';
import { AttemptService } from '../src/test-engine/attempt.service';
import { TimerService } from '../src/test-engine/timer.service';
import { AttemptLimitError } from '../src/test-engine/errors';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://bodhi:bodhi@localhost:5432/bodhi';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const migrationsFolder = fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url));

let handle: DbHandle;
let redis: Redis;

beforeAll(async () => {
  handle = createDb(DATABASE_URL);
  await runMigrations(handle.db, migrationsFolder);
  await handle.db.execute(sql`
    TRUNCATE TABLE
      audit.audit_log,
      assessment.responses,
      assessment.attempt_modules,
      assessment.scores,
      assessment.reports,
      assessment.attempts,
      assessment.assessment_modules,
      assessment.assessments,
      question_bank.question_options,
      question_bank.questions,
      question_bank.question_sets,
      candidate.candidates,
      core.refresh_tokens,
      core.users
    CASCADE`);
  redis = new Redis(REDIS_URL);
});

afterAll(async () => {
  await handle?.pool.end();
  redis?.disconnect();
});

describe('auth over Postgres', () => {
  it('registers, logs in, rotates refresh tokens, and writes the audit trail', async () => {
    const db = handle.db;
    const clock = new FixedClock(new Date());
    const tokens = new TokenService('int-secret', '15m', '7d');
    const auth = new AuthService(
      new DrizzleUserRepo(db),
      new DrizzleRefreshTokenStore(db),
      new BcryptHasher(4),
      tokens,
      new DrizzleAuditSink(db),
      clock,
    );

    const user = await auth.register({
      email: 'int@example.com',
      password: 'integration-pass',
      fullName: 'Integration User',
    });
    const rows = await db.select().from(users);
    expect(rows.map((r) => r.email)).toContain('int@example.com');

    const session = await auth.login('int@example.com', 'integration-pass');
    expect(tokens.verifyAccessToken(session.accessToken, clock.now().getTime()).sub).toBe(user.id);

    const rotated = await auth.refresh(session.refreshToken);
    await expect(auth.refresh(session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    await expect(auth.refresh(rotated.refreshToken)).resolves.toBeTruthy();

    const audits = await db.execute(sql`SELECT action FROM audit.audit_log`);
    const actions = audits.rows.map((r) => r.action);
    expect(actions).toContain('auth.register');
    expect(actions).toContain('auth.login');
    expect(actions).toContain('auth.refresh');
  });
});

describe('test engine over Postgres + Redis', () => {
  let candidateId: string;
  let assessmentId: string;
  let service: AttemptService;
  let clock: FixedClock;

  beforeAll(async () => {
    const db = handle.db;
    const [user] = await db
      .insert(users)
      .values({ email: `cand-${randomUUID()}@example.com`, passwordHash: 'x', role: 'candidate' })
      .returning();
    const [candidateRow] = await db
      .insert(candidates)
      .values({ userId: user!.id, dateOfBirth: '2009-05-01', gender: 'F' })
      .returning();
    candidateId = candidateRow!.id;

    const [assessmentRow] = await db
      .insert(assessments)
      .values({ code: 'INT-A1', name: 'Integration Assessment' })
      .returning();
    assessmentId = assessmentRow!.id;

    const setIds: string[] = [];
    for (const setCode of ['INT-QS1', 'INT-QS2']) {
      const [setRow] = await db
        .insert(questionSets)
        .values({ code: setCode, name: setCode, kind: 'aptitude' })
        .returning();
      setIds.push(setRow!.id);
      for (let i = 1; i <= 3; i += 1) {
        const [q] = await db
          .insert(questions)
          .values({ questionSetId: setRow!.id, text: `${setCode} Q${i}`, orderIndex: i })
          .returning();
        await db.insert(questionOptions).values([
          { questionId: q!.id, label: 'Agree', value: 1, orderIndex: 1 },
          { questionId: q!.id, label: 'Disagree', value: 0, orderIndex: 2 },
        ]);
      }
    }
    await db.insert(assessmentModules).values([
      { assessmentId, questionSetId: setIds[0]!, sequence: 1, durationSeconds: 300 },
      { assessmentId, questionSetId: setIds[1]!, sequence: 2, durationSeconds: 600 },
    ]);

    clock = new FixedClock(new Date());
    service = new AttemptService(
      new DrizzleAttemptRepo(db),
      new DrizzleModuleProgressRepo(db),
      new DrizzleAssessmentRepo(db),
      new DrizzleQuestionRepo(db),
      new DrizzleResponseRepo(db),
      new TimerService(new RedisTimerStore(redis, `int-${randomUUID()}:`), {
        policy: 'keep-running',
        graceMs: 45_000,
      }),
      clock,
      { maxAttempts: 3 },
    );
  });

  it('runs a full attempt lifecycle against real infrastructure', async () => {
    const attempt = await service.startAttempt(candidateId, assessmentId);
    expect(attempt.attemptNumber).toBe(1);

    const current = await service.currentModule(attempt.id);
    expect(current.progress.sequence).toBe(1);
    expect(current.timeLeftMs).toBe(300_000);

    const served = await service.questionsForCurrentModule(attempt.id);
    expect(served).toHaveLength(3);
    expect(served[0]!.options.map((o) => o.label).sort()).toEqual(['Agree', 'Disagree']);

    await service.saveAnswer(attempt.id, served[0]!.id, served[0]!.options[0]!.id);
    await service.saveAnswer(attempt.id, served[0]!.id, served[0]!.options[1]!.id);

    const first = await service.submitCurrentModule(attempt.id);
    expect(first.finished).toBe(false);
    const next = await service.currentModule(attempt.id);
    expect(next.progress.sequence).toBe(2);
    expect(next.timeLeftMs).toBe(600_000);

    const second = await service.submitCurrentModule(attempt.id);
    expect(second.finished).toBe(true);
    await expect(service.currentModule(attempt.id)).rejects.toThrow(/not in progress/);
  });

  it('enforces the BR-12 attempt lock across real rows', async () => {
    await service.startAttempt(candidateId, assessmentId);
    await service.startAttempt(candidateId, assessmentId);
    await expect(service.startAttempt(candidateId, assessmentId)).rejects.toThrow(
      AttemptLimitError,
    );
  });
});

describe('RedisTimerStore', () => {
  it('round-trips timer state through Redis', async () => {
    const store = new RedisTimerStore(redis, `unit-${randomUUID()}:`);
    const timer = new TimerService(store, { policy: 'pause', graceMs: 45_000 });
    const t0 = new Date();

    await timer.start('a1', 'm1', 600_000, t0);
    expect(await timer.timeLeftMs('a1', 'm1', new Date(t0.getTime() + 60_000))).toBe(540_000);

    await timer.onDisconnect('a1', 'm1', new Date(t0.getTime() + 120_000));
    expect(await timer.timeLeftMs('a1', 'm1', new Date(t0.getTime() + 999_000))).toBe(480_000);

    await timer.onReconnect('a1', 'm1', new Date(t0.getTime() + 999_000));
    expect(await timer.timeLeftMs('a1', 'm1', new Date(t0.getTime() + 999_000))).toBe(480_000);

    await timer.clear('a1', 'm1');
    expect(await timer.timeLeftMs('a1', 'm1', t0)).toBe(0);
  });
});
