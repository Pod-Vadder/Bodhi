import { loadEnv } from '@bodhi/shared-config';

/**
 * P1 entry point placeholder. The NestJS application (auth with JWT 15m/7d +
 * bcrypt(12) + RBAC, server-authoritative test engine, audit middleware) is
 * the next build phase; the env contract and workspace wiring are already live.
 */
const env = loadEnv();
console.log(
  `bodhi-api scaffold — NODE_ENV=${env.NODE_ENV}, timer policy=${env.TIMER_DISCONNECT_POLICY}, gateway=${env.PAYMENT_GATEWAY}`,
);
