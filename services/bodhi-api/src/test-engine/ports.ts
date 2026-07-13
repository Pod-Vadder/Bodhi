import type { AttemptStatus } from '@bodhi/shared-types';

export interface AttemptRecord {
  id: string;
  candidateId: string;
  assessmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
}

export interface ModuleDefinition {
  id: string;
  questionSetId: string;
  sequence: number;
  durationSeconds: number;
  randomizeQuestions: boolean;
}

export type ModuleProgressStatus = 'pending' | 'in_progress' | 'submitted' | 'expired';

export interface ModuleProgress {
  attemptId: string;
  moduleId: string;
  sequence: number;
  status: ModuleProgressStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface QuestionRecord {
  id: string;
  questionSetId: string;
  text: string;
  orderIndex: number;
  options: { id: string; label: string }[];
}

export interface AttemptRepo {
  countForCandidate(candidateId: string, assessmentId: string): Promise<number>;
  create(attempt: Omit<AttemptRecord, 'id'>): Promise<AttemptRecord>;
  findById(id: string): Promise<AttemptRecord | null>;
  update(attempt: AttemptRecord): Promise<void>;
}

export interface ModuleProgressRepo {
  createAll(progress: ModuleProgress[]): Promise<void>;
  forAttempt(attemptId: string): Promise<ModuleProgress[]>;
  update(progress: ModuleProgress): Promise<void>;
}

export interface AssessmentRepo {
  modulesFor(assessmentId: string): Promise<ModuleDefinition[]>;
}

export interface QuestionRepo {
  forQuestionSet(questionSetId: string): Promise<QuestionRecord[]>;
}

export interface ResponseRepo {
  upsert(attemptId: string, questionId: string, optionId: string | null, answeredAt: Date): Promise<void>;
  forAttempt(attemptId: string): Promise<{ questionId: string; optionId: string | null }[]>;
}

export interface TimerState {
  /** Fixed at module start under keep-running; recomputed on reconnect under pause. */
  deadlineMs: number;
  policy: 'keep-running' | 'pause';
  graceMs: number;
  pausedAtMs?: number;
  remainingMs?: number;
}

export interface TimerStore {
  get(key: string): Promise<TimerState | null>;
  set(key: string, state: TimerState): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryTimerStore implements TimerStore {
  private readonly states = new Map<string, TimerState>();

  async get(key: string): Promise<TimerState | null> {
    return this.states.get(key) ?? null;
  }

  async set(key: string, state: TimerState): Promise<void> {
    this.states.set(key, state);
  }

  async delete(key: string): Promise<void> {
    this.states.delete(key);
  }
}
