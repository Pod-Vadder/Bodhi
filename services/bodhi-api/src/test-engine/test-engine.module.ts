import { Module } from '@nestjs/common';
import type { Env } from '@bodhi/shared-config';
import type { Db } from '@bodhi/db';
import type Redis from 'ioredis';
import { AuthModule } from '../auth/auth.module';
import { SYSTEM_CLOCK } from '../auth/ports';
import {
  ASSESSMENT_REPO,
  ATTEMPT_REPO,
  ATTEMPT_SERVICE,
  DB,
  ENV,
  MODULE_PROGRESS_REPO,
  QUESTION_REPO,
  REDIS,
  RESPONSE_REPO,
  TIMER_STORE,
} from '../di-tokens';
import { AttemptService } from './attempt.service';
import {
  InMemoryAssessmentRepo,
  InMemoryAttemptRepo,
  InMemoryModuleProgressRepo,
  InMemoryQuestionRepo,
  InMemoryResponseRepo,
} from './memory-adapters';
import {
  DrizzleAssessmentRepo,
  DrizzleAttemptRepo,
  DrizzleModuleProgressRepo,
  DrizzleQuestionRepo,
  DrizzleResponseRepo,
} from '../persistence/drizzle-test-engine';
import { RedisTimerStore } from '../persistence/redis-timer-store';
import {
  InMemoryTimerStore,
  type AssessmentRepo,
  type AttemptRepo,
  type ModuleProgressRepo,
  type QuestionRepo,
  type ResponseRepo,
  type TimerStore,
} from './ports';
import { TestEngineController } from './test-engine.controller';
import { TimerService } from './timer.service';

/**
 * Each port is its own provider so the persistence choice is made once per
 * port, and so dev tooling can seed the in-memory adapters.
 */
@Module({
  imports: [AuthModule],
  controllers: [TestEngineController],
  providers: [
    {
      provide: ATTEMPT_REPO,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new DrizzleAttemptRepo(db) : new InMemoryAttemptRepo()),
    },
    {
      provide: MODULE_PROGRESS_REPO,
      inject: [DB],
      useFactory: (db: Db | null) =>
        db ? new DrizzleModuleProgressRepo(db) : new InMemoryModuleProgressRepo(),
    },
    {
      provide: ASSESSMENT_REPO,
      inject: [DB],
      useFactory: (db: Db | null) =>
        db ? new DrizzleAssessmentRepo(db) : new InMemoryAssessmentRepo(),
    },
    {
      provide: QUESTION_REPO,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new DrizzleQuestionRepo(db) : new InMemoryQuestionRepo()),
    },
    {
      provide: RESPONSE_REPO,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new DrizzleResponseRepo(db) : new InMemoryResponseRepo()),
    },
    {
      provide: TIMER_STORE,
      inject: [REDIS],
      useFactory: (redis: Redis | null) =>
        redis ? new RedisTimerStore(redis) : new InMemoryTimerStore(),
    },
    {
      provide: ATTEMPT_SERVICE,
      inject: [
        ATTEMPT_REPO,
        MODULE_PROGRESS_REPO,
        ASSESSMENT_REPO,
        QUESTION_REPO,
        RESPONSE_REPO,
        TIMER_STORE,
        ENV,
      ],
      useFactory: (
        attempts: AttemptRepo,
        moduleProgress: ModuleProgressRepo,
        assessments: AssessmentRepo,
        questions: QuestionRepo,
        responses: ResponseRepo,
        timerStore: TimerStore,
        env: Env,
      ) =>
        new AttemptService(
          attempts,
          moduleProgress,
          assessments,
          questions,
          responses,
          new TimerService(timerStore, {
            policy: env.TIMER_DISCONNECT_POLICY,
            graceMs: env.TIMER_RECONNECT_GRACE_SECONDS * 1000,
          }),
          SYSTEM_CLOCK,
          { maxAttempts: env.MAX_ATTEMPTS_PER_ASSESSMENT },
        ),
    },
  ],
  exports: [ATTEMPT_SERVICE, ASSESSMENT_REPO, QUESTION_REPO],
})
export class TestEngineModule {}
