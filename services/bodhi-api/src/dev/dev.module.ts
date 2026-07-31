import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TestEngineModule } from '../test-engine/test-engine.module';
import { DevSeedService } from './dev-seed.service';
import { DevUiController } from './dev-ui.controller';

@Module({
  imports: [AuthModule, TestEngineModule],
  controllers: [DevUiController],
  providers: [DevSeedService],
})
export class DevModule {}
