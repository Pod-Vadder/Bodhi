import { z } from 'zod';

const stenBandSchema = z.object({
  scale: z.string(),
  ageMin: z.number(),
  ageMax: z.number(),
  rawMin: z.number(),
  rawMax: z.number(),
  sten: z.number().int().min(1).max(10),
});

const stenClassificationSchema = z.object({
  low: z.tuple([z.number(), z.number()]),
  medium: z.tuple([z.number(), z.number()]),
  high: z.tuple([z.number(), z.number()]),
});

const interestBandsSchema = z.object({
  lowUpper: z.number(),
  highLower: z.number(),
});

const personalitySetSchema = z.object({
  id: z.string(),
  types: z.array(z.string()),
});

const careerSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  eligibility: z.array(z.string()).max(5),
  fit: z.object({
    aptitude: z.string().optional(),
    interest: z.string().optional(),
    personality: z.string().optional(),
  }),
  weights: z
    .object({
      aptitude: z.number().optional(),
      interest: z.number().optional(),
      personality: z.number().optional(),
    })
    .optional(),
  corrections: z.array(z.object({ when: z.string(), delta: z.number() })).optional(),
});

const wideRuleSchema = z.object({
  id: z.string(),
  when: z.string(),
  result: z.record(z.unknown()),
  priority: z.number().optional(),
});

const valueSchema = z.union([z.number(), z.string(), z.boolean()]);

const mbtiCountsSchema = z.object({
  E: z.number(),
  I: z.number(),
  S: z.number(),
  N: z.number(),
  T: z.number(),
  F: z.number(),
  J: z.number(),
  P: z.number(),
});

export const goldenCaseSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  /** Absolute numeric tolerance when diffing expected vs actual numbers. */
  tolerance: z.number().default(1e-6),
  candidate: z
    .object({
      age: z.number().optional(),
      gender: z.string().optional(),
    })
    .default({}),
  referenceData: z
    .object({
      stenTable: z.array(stenBandSchema).optional(),
      stenClassification: stenClassificationSchema.optional(),
      interestBands: interestBandsSchema.optional(),
      interestFormula: z
        .object({
          divisor: z.number().optional(),
          multiplier: z.number().optional(),
          roundDigits: z.number().optional(),
        })
        .optional(),
      personalitySets: z.array(personalitySetSchema).optional(),
      careers: z.array(careerSchema).optional(),
      rules: z.array(wideRuleSchema).optional(),
    })
    .default({}),
  input: z
    .object({
      aptitude: z.array(z.object({ scale: z.string(), raw: z.number() })).optional(),
      interests: z
        .array(z.object({ scale: z.string(), responses: z.array(z.number()) }))
        .optional(),
      mbti: mbtiCountsSchema.optional(),
      extraContext: z.record(valueSchema).optional(),
    })
    .default({}),
  expected: z
    .object({
      aptitude: z
        .array(
          z.object({
            scale: z.string(),
            sten: z.number().optional(),
            classification: z.enum(['L', 'M', 'H']).optional(),
          }),
        )
        .optional(),
      interests: z
        .array(
          z.object({
            scale: z.string(),
            score: z.number().optional(),
            classification: z.enum(['L', 'M', 'H']).optional(),
          }),
        )
        .optional(),
      mbtiType: z.string().optional(),
      personalitySet: z.string().optional(),
      csr: z
        .record(
          z.array(
            z.object({
              code: z.string(),
              rank: z.number().optional(),
              correctedTotal: z.number().optional(),
            }),
          ),
        )
        .optional(),
      ineligibleCareers: z.array(z.string()).optional(),
      ruleMatches: z.array(z.string()).optional(),
    })
    .default({}),
});

export type GoldenCase = z.infer<typeof goldenCaseSchema>;

export interface CaseFailure {
  path: string;
  expected: unknown;
  actual: unknown;
}

export interface CaseReport {
  caseId: string;
  description?: string;
  passed: boolean;
  failures: CaseFailure[];
  /** Set when the case aborted before comparison (bad fixture, engine error). */
  error?: string;
}

export interface SuiteReport {
  total: number;
  passed: number;
  failed: number;
  cases: CaseReport[];
}
