import { beforeEach, describe, expect, it } from 'vitest';
import { AttemptService } from '../src/test-engine/attempt.service';
import { TimerService } from '../src/test-engine/timer.service';
import {
  InMemoryAssessmentRepo,
  InMemoryAttemptRepo,
  InMemoryModuleProgressRepo,
  InMemoryQuestionRepo,
  InMemoryResponseRepo,
} from '../src/test-engine/memory-adapters';
import { InMemoryTimerStore } from '../src/test-engine/ports';
import { FixedClock } from '../src/auth/memory-adapters';
import { AttemptLimitError, TimerExpiredError } from '../src/test-engine/errors';

const ASSESSMENT = 'as-1';
const CANDIDATE = 'cd-1';
const MIN = 60_000;

describe('AttemptService', () => {
  let clock: FixedClock;
  let attempts: InMemoryAttemptRepo;
  let questions: InMemoryQuestionRepo;
  let responses: InMemoryResponseRepo;
  let service: AttemptService;

  beforeEach(() => {
    clock = new FixedClock(new Date('2026-07-13T10:00:00Z'));
    attempts = new InMemoryAttemptRepo();
    questions = new InMemoryQuestionRepo();
    responses = new InMemoryResponseRepo();

    const assessments = new InMemoryAssessmentRepo();
    assessments.setModules(ASSESSMENT, [
      { id: 'mod-2', questionSetId: 'qs-2', sequence: 2, durationSeconds: 600, randomizeQuestions: true },
      { id: 'mod-1', questionSetId: 'qs-1', sequence: 1, durationSeconds: 300, randomizeQuestions: true },
    ]);
    questions.setQuestions('qs-1', [
      { id: 'q1', questionSetId: 'qs-1', text: 'Q1?', orderIndex: 1, options: [{ id: 'o1', label: 'A' }] },
      { id: 'q2', questionSetId: 'qs-1', text: 'Q2?', orderIndex: 2, options: [{ id: 'o2', label: 'B' }] },
    ]);
    questions.setQuestions('qs-2', [
      { id: 'q3', questionSetId: 'qs-2', text: 'Q3?', orderIndex: 1, options: [{ id: 'o3', label: 'C' }] },
    ]);

    service = new AttemptService(
      attempts,
      new InMemoryModuleProgressRepo(),
      assessments,
      questions,
      responses,
      new TimerService(new InMemoryTimerStore(), { policy: 'keep-running', graceMs: 45_000 }),
      clock,
      { maxAttempts: 3 },
    );
  });

  it('starts an attempt on module 1 regardless of definition order (BR-13)', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
    expect(attempt.attemptNumber).toBe(1);
    const current = await service.currentModule(attempt.id);
    expect(current.module.id).toBe('mod-1');
    expect(current.timeLeftMs).toBe(5 * MIN);
  });

  it('locks after 3 attempts (BR-12)', async () => {
    for (let i = 1; i <= 3; i += 1) {
      const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
      expect(attempt.attemptNumber).toBe(i);
    }
    await expect(service.startAttempt(CANDIDATE, ASSESSMENT)).rejects.toThrow(AttemptLimitError);
  });

  it('serves questions only for the current module', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
    const served = await service.questionsForCurrentModule(attempt.id);
    expect(served.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('autosaves answers while the timer allows, and upserts on re-answer', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
    await service.saveAnswer(attempt.id, 'q1', 'o1');
    await service.saveAnswer(attempt.id, 'q1', null);
    const saved = await responses.forAttempt(attempt.id);
    expect(saved).toEqual([{ questionId: 'q1', optionId: null }]);
  });

  it('accepts answers inside the post-deadline grace window, rejects after', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
    clock.advanceMs(5 * MIN + 30_000);
    await service.saveAnswer(attempt.id, 'q1', 'o1');

    clock.advanceMs(16_000);
    await expect(service.saveAnswer(attempt.id, 'q2', 'o2')).rejects.toThrow(TimerExpiredError);
  });

  it('advances modules strictly in sequence and finishes the attempt (BR-13)', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);

    const first = await service.submitCurrentModule(attempt.id);
    expect(first.finished).toBe(false);
    const current = await service.currentModule(attempt.id);
    expect(current.module.id).toBe('mod-2');
    expect(current.timeLeftMs).toBe(10 * MIN);

    const second = await service.submitCurrentModule(attempt.id);
    expect(second.finished).toBe(true);

    const record = await attempts.findById(attempt.id);
    expect(record?.status).toBe('submitted');
    await expect(service.currentModule(attempt.id)).rejects.toThrow(/not in progress/);
  });

  it('marks a module expired when submitted after deadline + grace', async () => {
    const attempt = await service.startAttempt(CANDIDATE, ASSESSMENT);
    clock.advanceMs(6 * MIN);
    const result = await service.submitCurrentModule(attempt.id);
    expect(result.finished).toBe(false);
    const next = await service.currentModule(attempt.id);
    expect(next.module.id).toBe('mod-2');
  });

  it('separate candidates have independent attempt counters', async () => {
    for (let i = 0; i < 3; i += 1) await service.startAttempt(CANDIDATE, ASSESSMENT);
    await expect(service.startAttempt('cd-2', ASSESSMENT)).resolves.toBeTruthy();
  });
});
