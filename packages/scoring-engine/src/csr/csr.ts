import {
  compile,
  evaluateBoolean,
  evaluateNumber,
  type VariableBindings,
} from '../expression';
import { ScoringError } from '../types';

/**
 * Career Suitability Ranking (CSR) pipeline:
 *   1. eligibility filter (up to 5 criteria, all must hold)
 *   2. aptitude / interest / personality fit scores (expressions over the candidate context)
 *   3. weighted base total
 *   4. conditional correction deltas
 *   5. corrected total, ranked descending within career category
 *
 * Career definitions (expressions, weights, deltas) are reference data (D-04);
 * the engine implements the pipeline.
 */

export const MAX_ELIGIBILITY_CRITERIA = 5;

export interface CareerFitExpressions {
  aptitude?: string;
  interest?: string;
  personality?: string;
}

export interface CareerWeights {
  aptitude?: number;
  interest?: number;
  personality?: number;
}

export interface CareerCorrection {
  when: string;
  delta: number;
}

export interface CareerDefinition {
  code: string;
  name: string;
  category: string;
  eligibility: string[];
  fit: CareerFitExpressions;
  weights?: CareerWeights;
  corrections?: CareerCorrection[];
}

export interface AppliedCorrection extends CareerCorrection {
  applied: boolean;
}

export interface CareerScore {
  code: string;
  name: string;
  category: string;
  eligible: boolean;
  failedCriteria: string[];
  fits: { aptitude: number; interest: number; personality: number };
  baseTotal: number;
  corrections: AppliedCorrection[];
  correctedTotal: number;
  /** 1-based rank within the career's category, eligible careers only. */
  rank?: number;
}

export interface CsrResult {
  results: CareerScore[];
  /** Eligible careers per category, ranked. */
  rankedByCategory: Record<string, CareerScore[]>;
}

function wrapError(careerCode: string, stage: string, error: unknown): ScoringError {
  const detail = error instanceof Error ? error.message : String(error);
  return new ScoringError(`Career ${careerCode}, ${stage}: ${detail}`);
}

export function scoreCareer(career: CareerDefinition, bindings: VariableBindings): CareerScore {
  if (career.eligibility.length > MAX_ELIGIBILITY_CRITERIA) {
    throw new ScoringError(
      `Career ${career.code} has ${career.eligibility.length} eligibility criteria; maximum is ${MAX_ELIGIBILITY_CRITERIA}`,
    );
  }

  const failedCriteria: string[] = [];
  for (const criterion of career.eligibility) {
    let passed: boolean;
    try {
      passed = evaluateBoolean(criterion, bindings);
    } catch (error) {
      throw wrapError(career.code, `eligibility criterion '${criterion}'`, error);
    }
    if (!passed) failedCriteria.push(criterion);
  }
  const eligible = failedCriteria.length === 0;

  const fitValue = (component: keyof CareerFitExpressions): number => {
    const expr = career.fit[component];
    if (expr === undefined) return 0;
    try {
      return evaluateNumber(expr, bindings);
    } catch (error) {
      throw wrapError(career.code, `${component} fit '${expr}'`, error);
    }
  };

  const fits = {
    aptitude: fitValue('aptitude'),
    interest: fitValue('interest'),
    personality: fitValue('personality'),
  };

  const weightFor = (component: keyof CareerFitExpressions): number =>
    career.fit[component] === undefined ? 0 : (career.weights?.[component] ?? 1);

  const baseTotal =
    fits.aptitude * weightFor('aptitude') +
    fits.interest * weightFor('interest') +
    fits.personality * weightFor('personality');

  const corrections: AppliedCorrection[] = (career.corrections ?? []).map((correction) => {
    let applied: boolean;
    try {
      applied = evaluateBoolean(correction.when, bindings);
    } catch (error) {
      throw wrapError(career.code, `correction '${correction.when}'`, error);
    }
    return { ...correction, applied };
  });

  const correctedTotal =
    baseTotal + corrections.reduce((sum, c) => sum + (c.applied ? c.delta : 0), 0);

  return {
    code: career.code,
    name: career.name,
    category: career.category,
    eligible,
    failedCriteria,
    fits,
    baseTotal,
    corrections,
    correctedTotal,
  };
}

export function runCsr(careers: CareerDefinition[], bindings: VariableBindings): CsrResult {
  const codes = new Set<string>();
  for (const career of careers) {
    if (codes.has(career.code)) {
      throw new ScoringError(`Duplicate career code ${career.code}`);
    }
    codes.add(career.code);
  }

  const results = careers.map((career) => scoreCareer(career, bindings));

  const rankedByCategory: Record<string, CareerScore[]> = {};
  for (const result of results) {
    if (!result.eligible) continue;
    (rankedByCategory[result.category] ??= []).push(result);
  }
  for (const ranked of Object.values(rankedByCategory)) {
    ranked.sort(
      (a, b) => b.correctedTotal - a.correctedTotal || a.code.localeCompare(b.code),
    );
    ranked.forEach((result, index) => {
      result.rank = index + 1;
    });
  }

  return { results, rankedByCategory };
}

/** Compile-time validation of a career catalogue: surfaces bad expressions and unknown tokens before runtime. */
export function validateCareerDefinitions(
  careers: CareerDefinition[],
  knownTokens?: Set<string>,
): string[] {
  const problems: string[] = [];
  for (const career of careers) {
    const expressions = [
      ...career.eligibility,
      ...Object.values(career.fit).filter((e): e is string => e !== undefined),
      ...(career.corrections ?? []).map((c) => c.when),
    ];
    if (career.eligibility.length > MAX_ELIGIBILITY_CRITERIA) {
      problems.push(`${career.code}: more than ${MAX_ELIGIBILITY_CRITERIA} eligibility criteria`);
    }
    for (const source of expressions) {
      try {
        const compiled = compile(source);
        if (knownTokens) {
          for (const identifier of compiled.identifiers) {
            if (!knownTokens.has(identifier)) {
              problems.push(`${career.code}: unknown token '${identifier}' in '${source}'`);
            }
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        problems.push(`${career.code}: invalid expression '${source}' (${detail})`);
      }
    }
  }
  return problems;
}
