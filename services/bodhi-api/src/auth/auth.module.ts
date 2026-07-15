import { Module } from '@nestjs/common';
import type { Env } from '@bodhi/shared-config';
import type { Db } from '@bodhi/db';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BcryptHasher } from './password';
import { TokenService } from './tokens';
import { InMemoryAuditSink, InMemoryRefreshTokenStore, InMemoryUserRepo } from './memory-adapters';
import { SYSTEM_CLOCK, type AuditSink, type Clock, type RefreshTokenStore, type UserRepo } from './ports';
import {
  DrizzleAuditSink,
  DrizzleRefreshTokenStore,
  DrizzleUserRepo,
} from '../persistence/drizzle-auth';
import {
  AUDIT_SINK,
  AUTH_SERVICE,
  CLOCK,
  DB,
  ENV,
  REFRESH_TOKEN_STORE,
  TOKEN_SERVICE,
  USER_REPO,
} from '../di-tokens';
import { JwtAuthGuard, RolesGuard } from './guards';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: USER_REPO,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new DrizzleUserRepo(db) : new InMemoryUserRepo()),
    },
    {
      provide: REFRESH_TOKEN_STORE,
      inject: [DB],
      useFactory: (db: Db | null) =>
        db ? new DrizzleRefreshTokenStore(db) : new InMemoryRefreshTokenStore(),
    },
    {
      provide: AUDIT_SINK,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new DrizzleAuditSink(db) : new InMemoryAuditSink()),
    },
    { provide: CLOCK, useValue: SYSTEM_CLOCK },
    {
      provide: TOKEN_SERVICE,
      inject: [ENV],
      useFactory: (env: Env) => new TokenService(env.JWT_SECRET, env.JWT_ACCESS_TTL, env.JWT_REFRESH_TTL),
    },
    {
      provide: AUTH_SERVICE,
      inject: [USER_REPO, REFRESH_TOKEN_STORE, ENV, TOKEN_SERVICE, AUDIT_SINK, CLOCK],
      useFactory: (
        users: UserRepo,
        refreshTokens: RefreshTokenStore,
        env: Env,
        tokens: TokenService,
        audit: AuditSink,
        clock: Clock,
      ) => new AuthService(users, refreshTokens, new BcryptHasher(env.BCRYPT_ROUNDS), tokens, audit, clock),
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AUTH_SERVICE, TOKEN_SERVICE, AUDIT_SINK, CLOCK, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
