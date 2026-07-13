import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from '@bodhi/shared-config';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './domain-exception.filter';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new DomainExceptionFilter());
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(
    `bodhi-api listening on :${port} (env=${env.NODE_ENV}, timer=${env.TIMER_DISCONNECT_POLICY}, gateway=${env.PAYMENT_GATEWAY})`,
  );
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
