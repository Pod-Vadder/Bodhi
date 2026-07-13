import { describe, expect, it } from 'vitest';
import { InMemoryTimerStore } from '../src/test-engine/ports';
import { TimerService } from '../src/test-engine/timer.service';

const T0 = new Date('2026-07-13T10:00:00Z');
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);
const MIN = 60_000;

describe('TimerService — keep-running policy (D-27 default)', () => {
  const make = () =>
    new TimerService(new InMemoryTimerStore(), { policy: 'keep-running', graceMs: 45_000 });

  it('counts down from a fixed deadline', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    expect(await timer.timeLeftMs('a1', 'm1', at(4 * MIN))).toBe(6 * MIN);
    expect(await timer.timeLeftMs('a1', 'm1', at(11 * MIN))).toBe(0);
  });

  it('ignores disconnects: the deadline does not move', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    await timer.onDisconnect('a1', 'm1', at(2 * MIN));
    await timer.onReconnect('a1', 'm1', at(8 * MIN));
    expect(await timer.timeLeftMs('a1', 'm1', at(8 * MIN))).toBe(2 * MIN);
  });

  it('accepts answers through the grace window, then rejects', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    expect(await timer.canAccept('a1', 'm1', at(10 * MIN))).toBe(true);
    expect(await timer.canAccept('a1', 'm1', at(10 * MIN + 45_000))).toBe(true);
    expect(await timer.canAccept('a1', 'm1', at(10 * MIN + 45_001))).toBe(false);
  });

  it('reports hard expiry only past deadline + grace', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    expect(await timer.isExpired('a1', 'm1', at(10 * MIN + 45_000))).toBe(false);
    expect(await timer.isExpired('a1', 'm1', at(10 * MIN + 45_001))).toBe(true);
  });

  it('treats a missing timer as expired and unacceptable', async () => {
    const timer = make();
    expect(await timer.canAccept('a1', 'nope', T0)).toBe(false);
    expect(await timer.isExpired('a1', 'nope', T0)).toBe(true);
    expect(await timer.timeLeftMs('a1', 'nope', T0)).toBe(0);
  });
});

describe('TimerService — pause policy', () => {
  const make = () =>
    new TimerService(new InMemoryTimerStore(), { policy: 'pause', graceMs: 45_000 });

  it('freezes remaining time on disconnect and re-arms on reconnect', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    await timer.onDisconnect('a1', 'm1', at(3 * MIN));

    expect(await timer.timeLeftMs('a1', 'm1', at(30 * MIN))).toBe(7 * MIN);
    expect(await timer.isExpired('a1', 'm1', at(30 * MIN))).toBe(false);

    await timer.onReconnect('a1', 'm1', at(30 * MIN));
    expect(await timer.timeLeftMs('a1', 'm1', at(33 * MIN))).toBe(4 * MIN);
    expect(await timer.canAccept('a1', 'm1', at(37 * MIN + 45_000))).toBe(true);
    expect(await timer.canAccept('a1', 'm1', at(37 * MIN + 45_001))).toBe(false);
  });

  it('a second disconnect while already paused is a no-op', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    await timer.onDisconnect('a1', 'm1', at(3 * MIN));
    await timer.onDisconnect('a1', 'm1', at(5 * MIN));
    expect(await timer.timeLeftMs('a1', 'm1', at(9 * MIN))).toBe(7 * MIN);
  });

  it('disconnect after expiry freezes zero, not negative time', async () => {
    const timer = make();
    await timer.start('a1', 'm1', 10 * MIN, T0);
    await timer.onDisconnect('a1', 'm1', at(12 * MIN));
    expect(await timer.timeLeftMs('a1', 'm1', at(20 * MIN))).toBe(0);
  });
});
