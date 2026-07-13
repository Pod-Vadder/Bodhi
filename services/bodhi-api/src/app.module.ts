import { Global, Module } from '@nestjs/common';
import { loadEnv } from '@bodhi/shared-config';
import { AuthModule } from './auth/auth.module';
import { TestEngineModule } from './test-engine/test-engine.module';
import { ENV } from './di-tokens';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class EnvModule {}

@Module({
  imports: [EnvModule, AuthModule, TestEngineModule],
})
export class AppModule {}
