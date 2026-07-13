import { ScoringError, type Classification } from '../types';

/**
 * Legacy interest formula: score = (sum of item responses / divisor) * multiplier,
 * with divisor 15 and multiplier 10 in the legacy implementation (BR interest rule).
 */
export interface InterestFormulaOptions {
  divisor?: number;
  multiplier?: number;
  /** Round the final score to this many decimal places (half away from zero). Omit for no rounding. */
  roundDigits?: number;
}

/**
 * Score-space thresholds: score < lowUpper => L; score >= highLower => H; else M.
 * Real cut-offs are reference data (D-04); these defaults are placeholders.
 */
export interface InterestBands {
  lowUpper: number;
  highLower: number;
}

export const DEFAULT_INTEREST_BANDS: InterestBands = { lowUpper: 4, highLower: 7 };

export interface InterestInput {
  scale: string;
  responses: number[];
}

export interface InterestScore {
  scale: string;
  raw: number;
  score: number;
  classification: Classification;
}

export function scoreInterest(
  input: InterestInput,
  options: InterestFormulaOptions = {},
  bands: InterestBands = DEFAULT_INTEREST_BANDS,
): InterestScore {
  const divisor = options.divisor ?? 15;
  const multiplier = options.multiplier ?? 10;
  if (divisor === 0) throw new ScoringError('Interest divisor must be non-zero');

  const raw = input.responses.reduce((sum, r) => sum + r, 0);
  let score = (raw / divisor) * multiplier;
  if (options.roundDigits !== undefined) {
    const factor = 10 ** options.roundDigits;
    score = (Math.sign(score) * Math.round(Math.abs(score) * factor)) / factor;
  }
  return { scale: input.scale, raw, score, classification: classifyInterest(score, bands) };
}

export function classifyInterest(
  score: number,
  bands: InterestBands = DEFAULT_INTEREST_BANDS,
): Classification {
  if (score < bands.lowUpper) return 'L';
  if (score >= bands.highLower) return 'H';
  return 'M';
}

export function scoreInterests(
  inputs: InterestInput[],
  options: InterestFormulaOptions = {},
  bands: InterestBands = DEFAULT_INTEREST_BANDS,
): InterestScore[] {
  return inputs.map((input) => scoreInterest(input, options, bands));
}
