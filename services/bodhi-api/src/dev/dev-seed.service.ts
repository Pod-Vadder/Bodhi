import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Env } from '@bodhi/shared-config';
import { AuthService } from '../auth/auth.service';
import { EmailInUseError } from '../auth/errors';
import { InMemoryAssessmentRepo, InMemoryQuestionRepo } from '../test-engine/memory-adapters';
import type { AssessmentRepo, QuestionRepo } from '../test-engine/ports';
import { ASSESSMENT_REPO, AUTH_SERVICE, ENV, QUESTION_REPO } from '../di-tokens';

export const DEMO_EMAIL = 'demo.candidate@bodhi.local';
export const DEMO_PASSWORD = 'demo-pass-123';

export interface DevSeedContext {
  candidateId: string | null;
  assessments: { id: string; code: string; name: string }[];
}

/**
 * Zero-infrastructure dev mode: when PERSISTENCE=memory outside production,
 * seed a demo candidate and a two-module assessment into the in-memory
 * adapters at boot so `npm run api:dev` alone serves a usable /dev player.
 * With PERSISTENCE=postgres this does nothing — the Postgres seeder script
 * owns that path.
 */
@Injectable()
export class DevSeedService implements OnModuleInit {
  private context: DevSeedContext = { candidateId: null, assessments: [] };

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ASSESSMENT_REPO) private readonly assessments: AssessmentRepo,
    @Inject(QUESTION_REPO) private readonly questions: QuestionRepo,
  ) {}

  getContext(): DevSeedContext {
    return this.context;
  }

  async onModuleInit(): Promise<void> {
    const assessmentRepo = this.assessments;
    const questionRepo = this.questions;
    if (
      this.env.NODE_ENV === 'production' ||
      !(assessmentRepo instanceof InMemoryAssessmentRepo) ||
      !(questionRepo instanceof InMemoryQuestionRepo)
    ) {
      return;
    }

    try {
      await this.auth.register({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        fullName: 'Demo Candidate',
      });
    } catch (error) {
      if (!(error instanceof EmailInUseError)) throw error;
    }

    const assessmentId = randomUUID();
    const moduleSpecs = [
      { name: 'Aptitude (demo)', durationSeconds: 300 },
      { name: 'Interest (demo)', durationSeconds: 180 },
    ];

    assessmentRepo.setModules(
      assessmentId,
      moduleSpecs.map((spec, index) => {
        const questionSetId = randomUUID();
        questionRepo.setQuestions(
          questionSetId,
          Array.from({ length: 4 }, (_, i) => ({
            id: randomUUID(),
            questionSetId,
            text: `${spec.name} — question ${i + 1}?`,
            orderIndex: i + 1,
            options: [
              { id: randomUUID(), label: 'Agree' },
              { id: randomUUID(), label: 'Neutral' },
              { id: randomUUID(), label: 'Disagree' },
            ],
          })),
        );
        return {
          id: randomUUID(),
          questionSetId,
          sequence: index + 1,
          durationSeconds: spec.durationSeconds,
          randomizeQuestions: true,
        };
      }),
    );

    this.context = {
      candidateId: randomUUID(),
      assessments: [{ id: assessmentId, code: 'DEMO-A1', name: 'Demo Career Assessment' }],
    };
  }
}
