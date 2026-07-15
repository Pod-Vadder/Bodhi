import { and, asc, count, eq } from 'drizzle-orm';
import {
  assessmentModules,
  attemptModules,
  attempts,
  questionOptions,
  questions,
  responses,
  type Db,
} from '@bodhi/db';
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
} from '../test-engine/ports';

export class DrizzleAttemptRepo implements AttemptRepo {
  constructor(private readonly db: Db) {}

  async countForCandidate(candidateId: string, assessmentId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(attempts)
      .where(and(eq(attempts.candidateId, candidateId), eq(attempts.assessmentId, assessmentId)));
    return Number(rows[0]?.value ?? 0);
  }

  async create(attempt: Omit<AttemptRecord, 'id'>): Promise<AttemptRecord> {
    const rows = await this.db.insert(attempts).values(attempt).returning();
    const row = rows[0]!;
    return {
      id: row.id,
      candidateId: row.candidateId,
      assessmentId: row.assessmentId,
      attemptNumber: row.attemptNumber,
      status: row.status,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
    };
  }

  async findById(id: string): Promise<AttemptRecord | null> {
    const rows = await this.db.select().from(attempts).where(eq(attempts.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      candidateId: row.candidateId,
      assessmentId: row.assessmentId,
      attemptNumber: row.attemptNumber,
      status: row.status,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
    };
  }

  async update(attempt: AttemptRecord): Promise<void> {
    await this.db
      .update(attempts)
      .set({
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(attempts.id, attempt.id));
  }
}

export class DrizzleModuleProgressRepo implements ModuleProgressRepo {
  constructor(private readonly db: Db) {}

  async createAll(progress: ModuleProgress[]): Promise<void> {
    if (progress.length === 0) return;
    await this.db.insert(attemptModules).values(progress);
  }

  async forAttempt(attemptId: string): Promise<ModuleProgress[]> {
    const rows = await this.db
      .select()
      .from(attemptModules)
      .where(eq(attemptModules.attemptId, attemptId))
      .orderBy(asc(attemptModules.sequence));
    return rows.map((row) => ({
      attemptId: row.attemptId,
      moduleId: row.moduleId,
      sequence: row.sequence,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    }));
  }

  async update(progress: ModuleProgress): Promise<void> {
    await this.db
      .update(attemptModules)
      .set({
        status: progress.status,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attemptModules.attemptId, progress.attemptId),
          eq(attemptModules.moduleId, progress.moduleId),
        ),
      );
  }
}

export class DrizzleAssessmentRepo implements AssessmentRepo {
  constructor(private readonly db: Db) {}

  async modulesFor(assessmentId: string): Promise<ModuleDefinition[]> {
    const rows = await this.db
      .select()
      .from(assessmentModules)
      .where(eq(assessmentModules.assessmentId, assessmentId))
      .orderBy(asc(assessmentModules.sequence));
    return rows.map((row) => ({
      id: row.id,
      questionSetId: row.questionSetId,
      sequence: row.sequence,
      durationSeconds: row.durationSeconds,
      randomizeQuestions: row.randomizeQuestions,
    }));
  }
}

export class DrizzleQuestionRepo implements QuestionRepo {
  constructor(private readonly db: Db) {}

  async forQuestionSet(questionSetId: string): Promise<QuestionRecord[]> {
    const questionRows = await this.db
      .select()
      .from(questions)
      .where(and(eq(questions.questionSetId, questionSetId), eq(questions.isActive, true)))
      .orderBy(asc(questions.orderIndex));
    const records: QuestionRecord[] = [];
    for (const q of questionRows) {
      const optionRows = await this.db
        .select({ id: questionOptions.id, label: questionOptions.label })
        .from(questionOptions)
        .where(eq(questionOptions.questionId, q.id))
        .orderBy(asc(questionOptions.orderIndex));
      records.push({
        id: q.id,
        questionSetId: q.questionSetId,
        text: q.text,
        orderIndex: q.orderIndex,
        options: optionRows,
      });
    }
    return records;
  }
}

export class DrizzleResponseRepo implements ResponseRepo {
  constructor(private readonly db: Db) {}

  async upsert(
    attemptId: string,
    questionId: string,
    optionId: string | null,
    answeredAt: Date,
  ): Promise<void> {
    await this.db
      .insert(responses)
      .values({ attemptId, questionId, optionId, answeredAt })
      .onConflictDoUpdate({
        target: [responses.attemptId, responses.questionId],
        set: { optionId, answeredAt, updatedAt: new Date() },
      });
  }

  async forAttempt(attemptId: string): Promise<{ questionId: string; optionId: string | null }[]> {
    const rows = await this.db
      .select({ questionId: responses.questionId, optionId: responses.optionId })
      .from(responses)
      .where(eq(responses.attemptId, attemptId));
    return rows;
  }
}
