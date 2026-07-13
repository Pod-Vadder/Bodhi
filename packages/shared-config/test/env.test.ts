import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src';

describe('loadEnv', () => {
  it('applies documented defaults on an empty environment', () => {
    const env = loadEnv({});
    expect(env.TIMER_DISCONNECT_POLICY).toBe('keep-running');
    expect(env.TIMER_RECONNECT_GRACE_SECONDS).toBe(45);
    expect(env.PAYMENT_GATEWAY).toBe('ccavenue');
    expect(env.MAX_ATTEMPTS_PER_ASSESSMENT).toBe(3);
    expect(env.BCRYPT_ROUNDS).toBe(12);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.JWT_REFRESH_TTL).toBe('7d');
  });

  it('coerces numeric strings and validates enums', () => {
    const env = loadEnv({
      BCRYPT_ROUNDS: '14',
      TIMER_DISCONNECT_POLICY: 'pause',
      PAYMENT_GATEWAY: 'razorpay',
    });
    expect(env.BCRYPT_ROUNDS).toBe(14);
    expect(env.TIMER_DISCONNECT_POLICY).toBe('pause');
    expect(env.PAYMENT_GATEWAY).toBe('razorpay');
  });

  it('rejects invalid values', () => {
    expect(() => loadEnv({ PAYMENT_GATEWAY: 'stripe' })).toThrow();
    expect(() => loadEnv({ BCRYPT_ROUNDS: '4' })).toThrow();
    expect(() => loadEnv({ DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
