import { randomUUID } from 'node:crypto';
import type {
  AssessmentRepo,
  AttemptRecord,
  AttemptRepo,
  ModuleDefinition,
  ModuleProgress,
  ModuleProgressRepo,
  QuestionRecord,
  QuestionRepo,
  ResponseRepo,
} from './ports';

export class InMemoryAttemptRepo implements AttemptRepo {
  private readonly byId = new Map<string, AttemptRecord>();

  async countForCandidate(candidateId: string, assessmentId: string): Promise<number> {
    return [...this.byId.values()].filter(
      (a) => a.candidateId === candidateId && a.assessmentId === assessmentId,
    ).length;
  }

  async create(attempt: Omit<AttemptRecord, 'id'>): Promise<AttemptRecord> {
    const record: AttemptRecord = { id: randomUUID(), ...attempt };
    this.byId.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<AttemptRecord | null> {
    const record = this.byId.get(id);
    return record ? { ...record } : null;
  }

  async update(attempt: AttemptRecord): Promise<void> {
    this.byId.set(attempt.id, { ...attempt });
  }
}

export class InMemoryModuleProgressRepo implements ModuleProgressRepo {
  private readonly rows: ModuleProgress[] = [];

  async createAll(progress: ModuleProgress[]): Promise<void> {
    this.rows.push(...progress.map((p) => ({ ...p })));
  }

  async forAttempt(attemptId: string): Promise<ModuleProgress[]> {
    return this.rows.filter((p) => p.attemptId === attemptId).map((p) => ({ ...p }));
  }

  async update(progress: ModuleProgress): Promise<void> {
    const index = this.rows.findIndex(
      (p) => p.attemptId === progress.attemptId && p.moduleId === progress.moduleId,
    );
    if (index >= 0) this.rows[index] = { ...progress };
  }
}

export class InMemoryAssessmentRepo implements AssessmentRepo {
  private readonly byAssessment = new Map<string, ModuleDefinition[]>();

  setModules(assessmentId: string, modules: ModuleDefinition[]): void {
    this.byAssessment.set(assessmentId, modules);
  }

  async modulesFor(assessmentId: string): Promise<ModuleDefinition[]> {
    return this.byAssessment.get(assessmentId) ?? [];
  }
}

export class InMemoryQuestionRepo implements QuestionRepo {
  private readonly bySet = new Map<string, QuestionRecord[]>();

  setQuestions(questionSetId: string, questions: QuestionRecord[]): void {
    this.bySet.set(questionSetId, questions);
  }

  async forQuestionSet(questionSetId: string): Promise<QuestionRecord[]> {
    return this.bySet.get(questionSetId) ?? [];
  }
}

export class InMemoryResponseRepo implements ResponseRepo {
  readonly rows = new Map<string, { questionId: string; optionId: string | null; answeredAt: Date }>();

  async upsert(
    attemptId: string,
    questionId: string,
    optionId: string | null,
    answeredAt: Date,
  ): Promise<void> {
    this.rows.set(`${attemptId}:${questionId}`, { questionId, optionId, answeredAt });
  }

  async forAttempt(attemptId: string): Promise<{ questionId: string; optionId: string | null }[]> {
    return [...this.rows.entries()]
      .filter(([key]) => key.startsWith(`${attemptId}:`))
      .map(([, value]) => ({ questionId: value.questionId, optionId: value.optionId }));
  }
}
