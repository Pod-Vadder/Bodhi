import type Redis from 'ioredis';
import type { TimerState, TimerStore } from '../test-engine/ports';

/**
 * Redis-backed timer store: the authoritative deadline survives API restarts
 * and is shared across instances. Keys are cleared on module submit; a
 * defensive TTL caps orphaned keys.
 */
export class RedisTimerStore implements TimerStore {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'bodhi:',
    private readonly orphanTtlSeconds = 7 * 24 * 3600,
  ) {}

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<TimerState | null> {
    const raw = await this.redis.get(this.fullKey(key));
    return raw ? (JSON.parse(raw) as TimerState) : null;
  }

  async set(key: string, state: TimerState): Promise<void> {
    await this.redis.set(this.fullKey(key), JSON.stringify(state), 'EX', this.orphanTtlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.fullKey(key));
  }
}
