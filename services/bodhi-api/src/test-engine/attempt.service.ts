import type { Clock } from '../auth/ports';
import {
  AttemptLimitError,
  AttemptNotFoundError,
  AttemptStateError,
  ModuleSequenceError,
  TimerExpiredError,
} from './errors';
import type {
  AssessmentRepo,
  AttemptRecord,
  AttemptRepo,
  ModuleDefinition,
  ModuleProgress,
  ModuleProgressRepo,
  QuestionRepo,
  ResponseRepo,
} from './ports';
import { serveQuestions, type ServedQuestion } from './serving';
import { TimerService } from './timer.service';

export interface AttemptServiceOptions {
  /** BR-12: attempts allowed before the assessment locks for the candidate. */
  maxAttempts: number;
}

export interface CurrentModuleView {
  module: ModuleDefinition;
  progress: ModuleProgress;
  timeLeftMs: number;
}

export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepo,
    private readonly moduleProgress: ModuleProgressRepo,
    private readonly assessments: AssessmentRepo,
    private readonly questions: QuestionRepo,
    private readonly responses: ResponseRepo,
    private readonly timers: TimerService,
    private readonly clock: Clock,
    private readonly options: AttemptServiceOptions,
  ) {}

  /** BR-12: the (maxAttempts+1)-th start is refused. BR-13: module 1 starts immediately. */
  async startAttempt(candidateId: string, assessmentId: string): Promise<AttemptRecord> {
    const existing = await this.attempts.countForCandidate(candidateId, assessmentId);
    if (existing >= this.options.maxAttempts) {
      throw new AttemptLimitError(this.options.maxAttempts);
    }

    const modules = await this.assessments.modulesFor(assessmentId);
    if (modules.length === 0) {
      throw new AttemptStateError(`Assessment ${assessmentId} has no modules configured`);
    }
    const ordered = [...modules].sort((a, b) => a.sequence - b.sequence);

    const now = this.clock.now();
    const attempt = await this.attempts.create({
      candidateId,
      assessmentId,
      attemptNumber: existing + 1,
      status: 'in_progress',
      startedAt: now,
      submittedAt: null,
    });

    await this.moduleProgress.createAll(
      ordered.map((m, index) => ({
        attemptId: attempt.id,
        moduleId: m.id,
        sequence: m.sequence,
        status: index === 0 ? 'in_progress' : 'pending',
        startedAt: index === 0 ? now : null,
        completedAt: null,
      })),
    );
    await this.timers.start(attempt.id, ordered[0]!.id, ordered[0]!.durationSeconds * 1000, now);
    return attempt;
  }

  /** BR-13: the single module the candidate may work on right now. */
  async currentModule(attemptId: string): Promise<CurrentModuleView> {
    const attempt = await this.requireAttempt(attemptId);
    if (attempt.status !== 'in_progress') {
      throw new AttemptStateError(`Attempt is ${attempt.status}, not in progress`);
    }
    const { module, progress } = await this.requireCurrent(attempt);
    return {
      module,
      progress,
      timeLeftMs: await this.timers.timeLeftMs(attemptId, module.id, this.clock.now()),
    };
  }

  /** Randomized, sanitized questions for the current module only (BR-13). */
  async questionsForCurrentModule(attemptId: string): Promise<ServedQuestion[]> {
    const attempt = await this.requireAttempt(attemptId);
    const { module } = await this.requireCurrent(attempt);
    const questions = await this.questions.forQuestionSet(module.questionSetId);
    return serveQuestions(questions, attemptId, module.id, module.randomizeQuestions);
  }

  /** Autosave: accepted only while the current module's timer (plus grace) allows it. */
  async saveAnswer(attemptId: string, questionId: string, optionId: string | null): Promise<void> {
    const attempt = await this.requireAttempt(attemptId);
    if (attempt.status !== 'in_progress') {
      throw new AttemptStateError(`Attempt is ${attempt.status}; answers are closed`);
    }
    const { module } = await this.requireCurrent(attempt);
    const now = this.clock.now();
    if (!(await this.timers.canAccept(attemptId, module.id, now))) {
      await this.expireModule(attempt, module.id);
      throw new TimerExpiredError();
    }
    await this.responses.upsert(attemptId, questionId, optionId, now);
  }

  /** Submit the current module; the next module (if any) starts immediately (BR-13). */
  async submitCurrentModule(attemptId: string): Promise<{ finished: boolean }> {
    const attempt = await this.requireAttempt(attemptId);
    const { module, progress } = await this.requireCurrent(attempt);
    const now = this.clock.now();

    const accepted = await this.timers.canAccept(attemptId, module.id, now);
    await this.timers.clear(attemptId, module.id);
    await this.moduleProgress.update({
      ...progress,
      status: accepted ? 'submitted' : 'expired',
      completedAt: now,
    });

    const all = await this.moduleProgress.forAttempt(attemptId);
    const next = all
      .filter((p) => p.status === 'pending')
      .sort((a, b) => a.sequence - b.sequence)[0];

    if (!next) {
      attempt.status = 'submitted';
      attempt.submittedAt = now;
      await this.attempts.update(attempt);
      return { finished: true };
    }

    const modules = await this.assessments.modulesFor(attempt.assessmentId);
    const nextDef = modules.find((m) => m.id === next.moduleId)!;
    await this.moduleProgress.update({ ...next, status: 'in_progress', startedAt: now });
    await this.timers.start(attemptId, nextDef.id, nextDef.durationSeconds * 1000, now);
    return { finished: false };
  }

  async timeLeftMs(attemptId: string): Promise<number> {
    const attempt = await this.requireAttempt(attemptId);
    const { module } = await this.requireCurrent(attempt);
    return this.timers.timeLeftMs(attemptId, module.id, this.clock.now());
  }

  private async requireAttempt(attemptId: string): Promise<AttemptRecord> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt) throw new AttemptNotFoundError(attemptId);
    return attempt;
  }

  private async requireCurrent(
    attempt: AttemptRecord,
  ): Promise<{ module: ModuleDefinition; progress: ModuleProgress }> {
    const all = await this.moduleProgress.forAttempt(attempt.id);
    const current = all
      .filter((p) => p.status === 'in_progress')
      .sort((a, b) => a.sequence - b.sequence)[0];
    if (!current) {
      throw new ModuleSequenceError('No module is currently in progress for this attempt');
    }
    const modules = await this.assessments.modulesFor(attempt.assessmentId);
    const module = modules.find((m) => m.id === current.moduleId);
    if (!module) {
      throw new ModuleSequenceError(`Module ${current.moduleId} missing from assessment definition`);
    }
    return { module, progress: current };
  }

  private async expireModule(attempt: AttemptRecord, moduleId: string): Promise<void> {
    const all = await this.moduleProgress.forAttempt(attempt.id);
    const progress = all.find((p) => p.moduleId === moduleId);
    if (progress && progress.status === 'in_progress') {
      await this.moduleProgress.update({
        ...progress,
        status: 'expired',
        completedAt: this.clock.now(),
      });
    }
  }
}
