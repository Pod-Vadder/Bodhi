import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url().default('postgres://bodhi:bodhi@localhost:5432/bodhi'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /** postgres = Drizzle/Postgres + Redis adapters; memory = DB-less dev/test mode. */
  PERSISTENCE: z.enum(['memory', 'postgres']).default('memory'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('minio'),
  S3_SECRET_KEY: z.string().default('minio12345'),
  S3_BUCKET: z.string().default('bodhi'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),

  JWT_SECRET: z.string().default('change-me-in-production'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),

  /** D-27 decision: keep-running with a reconnect grace window is the default. */
  TIMER_DISCONNECT_POLICY: z.enum(['keep-running', 'pause']).default('keep-running'),
  TIMER_RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(0).default(45),

  /** D-09 decision: CCAvenue retained behind the payment adapter. */
  PAYMENT_GATEWAY: z.enum(['ccavenue', 'razorpay']).default('ccavenue'),

  /** BR-12: attempts lock at this count. */
  MAX_ATTEMPTS_PER_ASSESSMENT: z.coerce.number().int().min(1).default(3),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
