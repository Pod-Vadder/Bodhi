import type { TimerState, TimerStore } from './ports';

export interface TimerPolicyOptions {
  policy: 'keep-running' | 'pause';
  graceMs: number;
}

/**
 * Server-authoritative module timer (D-27). The client clock is never
 * consulted; every decision is made against server time.
 *
 * keep-running (default): the deadline is fixed at module start. A disconnect
 * changes nothing; the grace window only extends how long after the deadline
 * a reconnecting client's in-flight answers are still accepted.
 *
 * pause: a disconnect freezes the remaining time; reconnect re-arms the
 * deadline at now + remaining.
 */
export class TimerService {
  constructor(
    private readonly store: TimerStore,
    private readonly options: TimerPolicyOptions,
  ) {}

  private key(attemptId: string, moduleId: string): string {
    return `timer:${attemptId}:${moduleId}`;
  }

  async start(attemptId: string, moduleId: string, durationMs: number, now: Date): Promise<TimerState> {
    const state: TimerState = {
      deadlineMs: now.getTime() + durationMs,
      policy: this.options.policy,
      graceMs: this.options.graceMs,
    };
    await this.store.set(this.key(attemptId, moduleId), state);
    return state;
  }

  async onDisconnect(attemptId: string, moduleId: string, now: Date): Promise<void> {
    const key = this.key(attemptId, moduleId);
    const state = await this.store.get(key);
    if (!state || state.policy !== 'pause' || state.pausedAtMs !== undefined) return;
    await this.store.set(key, {
      ...state,
      pausedAtMs: now.getTime(),
      remainingMs: Math.max(0, state.deadlineMs - now.getTime()),
    });
  }

  async onReconnect(attemptId: string, moduleId: string, now: Date): Promise<void> {
    const key = this.key(attemptId, moduleId);
    const state = await this.store.get(key);
    if (!state || state.policy !== 'pause' || state.pausedAtMs === undefined) return;
    await this.store.set(key, {
      deadlineMs: now.getTime() + (state.remainingMs ?? 0),
      policy: state.policy,
      graceMs: state.graceMs,
    });
  }

  /** Remaining time shown to the candidate; never negative. */
  async timeLeftMs(attemptId: string, moduleId: string, now: Date): Promise<number> {
    const state = await this.store.get(this.key(attemptId, moduleId));
    if (!state) return 0;
    if (state.pausedAtMs !== undefined) return state.remainingMs ?? 0;
    return Math.max(0, state.deadlineMs - now.getTime());
  }

  /** Whether an answer/submission arriving now is still accepted (deadline + grace). */
  async canAccept(attemptId: string, moduleId: string, now: Date): Promise<boolean> {
    const state = await this.store.get(this.key(attemptId, moduleId));
    if (!state) return false;
    if (state.pausedAtMs !== undefined) return true;
    return now.getTime() <= state.deadlineMs + state.graceMs;
  }

  /** Hard expiry: past deadline + grace (a paused timer cannot expire). */
  async isExpired(attemptId: string, moduleId: string, now: Date): Promise<boolean> {
    const state = await this.store.get(this.key(attemptId, moduleId));
    if (!state) return true;
    if (state.pausedAtMs !== undefined) return false;
    return now.getTime() > state.deadlineMs + state.graceMs;
  }

  async clear(attemptId: string, moduleId: string): Promise<void> {
    await this.store.delete(this.key(attemptId, moduleId));
  }
}
