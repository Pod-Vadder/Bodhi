import { Global, Module } from '@nestjs/common';
import { loadEnv, type Env } from '@bodhi/shared-config';
import { createDb, type Db } from '@bodhi/db';
import Redis from 'ioredis';
import { AuthModule } from './auth/auth.module';
import { TestEngineModule } from './test-engine/test-engine.module';
import { DB, ENV, REDIS } from './di-tokens';

/**
 * PERSISTENCE=postgres wires Drizzle/Postgres + Redis adapters;
 * PERSISTENCE=memory (default) keeps everything in-process for
 * DB-less development and unit tests.
 */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    {
      provide: DB,
      inject: [ENV],
      useFactory: (env: Env): Db | null =>
        env.PERSISTENCE === 'postgres' ? createDb(env.DATABASE_URL).db : null,
    },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env): Redis | null =>
        env.PERSISTENCE === 'postgres' ? new Redis(env.REDIS_URL) : null,
    },
  ],
  exports: [ENV, DB, REDIS],
})
export class EnvModule {}

@Module({
  imports: [EnvModule, AuthModule, TestEngineModule],
})
export class AppModule {}
