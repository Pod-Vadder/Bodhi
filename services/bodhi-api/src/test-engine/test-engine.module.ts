import { Module } from '@nestjs/common';
import type { Env } from '@bodhi/shared-config';
import type { Db } from '@bodhi/db';
import type Redis from 'ioredis';
import { AuthModule } from '../auth/auth.module';
import { SYSTEM_CLOCK } from '../auth/ports';
import { ATTEMPT_SERVICE, DB, ENV, REDIS } from '../di-tokens';
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
import { InMemoryTimerStore } from './ports';
import { TestEngineController } from './test-engine.controller';
import { TimerService } from './timer.service';

@Module({
  imports: [AuthModule],
  controllers: [TestEngineController],
  providers: [
    {
      provide: ATTEMPT_SERVICE,
      inject: [ENV, DB, REDIS],
      useFactory: (env: Env, db: Db | null, redis: Redis | null) =>
        new AttemptService(
          db ? new DrizzleAttemptRepo(db) : new InMemoryAttemptRepo(),
          db ? new DrizzleModuleProgressRepo(db) : new InMemoryModuleProgressRepo(),
          db ? new DrizzleAssessmentRepo(db) : new InMemoryAssessmentRepo(),
          db ? new DrizzleQuestionRepo(db) : new InMemoryQuestionRepo(),
          db ? new DrizzleResponseRepo(db) : new InMemoryResponseRepo(),
          new TimerService(redis ? new RedisTimerStore(redis) : new InMemoryTimerStore(), {
            policy: env.TIMER_DISCONNECT_POLICY,
            graceMs: env.TIMER_RECONNECT_GRACE_SECONDS * 1000,
          }),
          SYSTEM_CLOCK,
          { maxAttempts: env.MAX_ATTEMPTS_PER_ASSESSMENT },
        ),
    },
  ],
})
export class TestEngineModule {}
