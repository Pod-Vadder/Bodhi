import { Module } from '@nestjs/common';
import type { Env } from '@bodhi/shared-config';
import { AuthModule } from '../auth/auth.module';
import { SYSTEM_CLOCK } from '../auth/ports';
import { ATTEMPT_SERVICE, ENV } from '../di-tokens';
import { AttemptService } from './attempt.service';
import {
  InMemoryAssessmentRepo,
  InMemoryAttemptRepo,
  InMemoryModuleProgressRepo,
  InMemoryQuestionRepo,
  InMemoryResponseRepo,
} from './memory-adapters';
import { InMemoryTimerStore } from './ports';
import { TestEngineController } from './test-engine.controller';
import { TimerService } from './timer.service';

/**
 * In-memory persistence until P1 DB wiring; the TimerStore swaps to a
 * Redis-backed implementation at the same time. Domain services are
 * constructed via factories so no reflection metadata is required.
 */
@Module({
  imports: [AuthModule],
  controllers: [TestEngineController],
  providers: [
    {
      provide: ATTEMPT_SERVICE,
      inject: [ENV],
      useFactory: (env: Env) =>
        new AttemptService(
          new InMemoryAttemptRepo(),
          new InMemoryModuleProgressRepo(),
          new InMemoryAssessmentRepo(),
          new InMemoryQuestionRepo(),
          new InMemoryResponseRepo(),
          new TimerService(new InMemoryTimerStore(), {
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
