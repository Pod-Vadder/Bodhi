import { describe, expect, it } from 'vitest';
import {
  runCsr,
  scoreCareer,
  validateCareerDefinitions,
  ScoringError,
  type CareerDefinition,
  type VariableBindings,
} from '../src';

const bindings: VariableBindings = {
  WS1: 8,
  WS2: 4,
  I001: 7.5,
  AGE: 16,
  GENDER: 'M',
  TYPE: 'ENFP',
  E: 12,
  I: 8,
  J: 7,
  P: 13,
};

const softwareEngineer: CareerDefinition = {
  code: 'C001',
  name: 'Software Engineer',
  category: 'Engineering',
  eligibility: ['WS1 >= 6', 'AGE >= 15'],
  fit: {
    aptitude: 'WS1 + WS2',
    interest: 'I001',
    personality: "IF(TYPE = 'ENFP', 5, 2)",
  },
  corrections: [{ when: "GENDER = 'M'", delta: 1 }],
};

describe('scoreCareer', () => {
  it('runs the full pipeline: eligibility, fits, base total, corrections', () => {
    const score = scoreCareer(softwareEngineer, bindings);
    expect(score.eligible).toBe(true);
    expect(score.failedCriteria).toEqual([]);
    expect(score.fits).toEqual({ aptitude: 12, interest: 7.5, personality: 5 });
    expect(score.baseTotal).toBeCloseTo(24.5, 8);
    expect(score.corrections).toEqual([{ when: "GENDER = 'M'", delta: 1, applied: true }]);
    expect(score.correctedTotal).toBeCloseTo(25.5, 8);
  });

  it('records failed criteria and marks the career ineligible', () => {
    const strict: CareerDefinition = {
      ...softwareEngineer,
      code: 'C009',
      eligibility: ['WS1 >= 9', 'AGE >= 15'],
    };
    const score = scoreCareer(strict, bindings);
    expect(score.eligible).toBe(false);
    expect(score.failedCriteria).toEqual(['WS1 >= 9']);
  });

  it('applies component weights, defaulting to 1', () => {
    const weighted: CareerDefinition = {
      ...softwareEngineer,
      code: 'C010',
      weights: { aptitude: 2, interest: 0.5 },
      corrections: [],
    };
    const score = scoreCareer(weighted, bindings);
    expect(score.baseTotal).toBeCloseTo(12 * 2 + 7.5 * 0.5 + 5 * 1, 8);
  });

  it('treats missing fit expressions as zero contribution', () => {
    const aptitudeOnly: CareerDefinition = {
      code: 'C011',
      name: 'X',
      category: 'Y',
      eligibility: [],
      fit: { aptitude: 'WS1' },
    };
    const score = scoreCareer(aptitudeOnly, bindings);
    expect(score.baseTotal).toBe(8);
  });

  it('skips corrections whose condition is false', () => {
    const withCorrections: CareerDefinition = {
      ...softwareEngineer,
      code: 'C012',
      corrections: [
        { when: "GENDER = 'F'", delta: 3 },
        { when: 'WS1 >= 8', delta: -2 },
      ],
    };
    const score = scoreCareer(withCorrections, bindings);
    expect(score.corrections.map((c) => c.applied)).toEqual([false, true]);
    expect(score.correctedTotal).toBeCloseTo(score.baseTotal - 2, 8);
  });

  it('rejects more than 5 eligibility criteria', () => {
    const tooMany: CareerDefinition = {
      ...softwareEngineer,
      code: 'C013',
      eligibility: ['1=1', '1=1', '1=1', '1=1', '1=1', '1=1'],
    };
    expect(() => scoreCareer(tooMany, bindings)).toThrow(/maximum is 5/);
  });

  it('wraps expression failures with the career code and stage', () => {
    const broken: CareerDefinition = {
      ...softwareEngineer,
      code: 'C014',
      fit: { aptitude: 'WS99' },
    };
    expect(() => scoreCareer(broken, bindings)).toThrow(/Career C014, aptitude fit/);
  });
});

describe('runCsr', () => {
  const careers: CareerDefinition[] = [
    softwareEngineer,
    {
      code: 'C002',
      name: 'Civil Engineer',
      category: 'Engineering',
      eligibility: ['WS1 >= 9'],
      fit: { aptitude: 'WS1' },
    },
    {
      code: 'C003',
      name: 'Data Analyst',
      category: 'Engineering',
      eligibility: ['WS2 >= 4'],
      fit: { aptitude: 'WS2 * 2', interest: 'I001' },
    },
    {
      code: 'C004',
      name: 'Counselling Psychologist',
      category: 'Social Sciences',
      eligibility: [],
      fit: { personality: "IF(TYPE = 'ENFP', 9, 1)" },
    },
  ];

  it('ranks eligible careers per category by corrected total', () => {
    const { results, rankedByCategory } = runCsr(careers, bindings);
    expect(results).toHaveLength(4);

    const engineering = rankedByCategory['Engineering']!;
    expect(engineering.map((c) => [c.code, c.rank])).toEqual([
      ['C001', 1],
      ['C003', 2],
    ]);
    expect(rankedByCategory['Social Sciences']!.map((c) => c.code)).toEqual(['C004']);

    const ineligible = results.find((r) => r.code === 'C002')!;
    expect(ineligible.eligible).toBe(false);
    expect(ineligible.rank).toBeUndefined();
  });

  it('breaks ranking ties deterministically by career code', () => {
    const tied: CareerDefinition[] = [
      { code: 'C020', name: 'B', category: 'Cat', eligibility: [], fit: { aptitude: '10' } },
      { code: 'C019', name: 'A', category: 'Cat', eligibility: [], fit: { aptitude: '10' } },
    ];
    const { rankedByCategory } = runCsr(tied, bindings);
    expect(rankedByCategory['Cat']!.map((c) => [c.code, c.rank])).toEqual([
      ['C019', 1],
      ['C020', 2],
    ]);
  });

  it('rejects duplicate career codes', () => {
    expect(() => runCsr([softwareEngineer, softwareEngineer], bindings)).toThrow(ScoringError);
  });
});

describe('validateCareerDefinitions', () => {
  it('flags syntax errors, unknown tokens, and criterion overflow', () => {
    const problems = validateCareerDefinitions(
      [
        {
          code: 'C030',
          name: 'X',
          category: 'Y',
          eligibility: ['WS1 >=', '1=1', '1=1', '1=1', '1=1', '1=1'],
          fit: { aptitude: 'WS99 + 1' },
          corrections: [{ when: "GENDER = 'M'", delta: 1 }],
        },
      ],
      new Set(['WS1', 'GENDER']),
    );
    expect(problems.some((p) => p.includes('invalid expression'))).toBe(true);
    expect(problems.some((p) => p.includes("unknown token 'WS99'"))).toBe(true);
    expect(problems.some((p) => p.includes('more than 5'))).toBe(true);
  });

  it('returns no problems for a valid catalogue', () => {
    expect(validateCareerDefinitions([softwareEngineer])).toEqual([]);
  });
});
