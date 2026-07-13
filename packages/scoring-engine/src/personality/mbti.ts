import { ScoringError } from '../types';

export type MbtiLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

/** Response counts toward each pole, produced by tallying the personality questionnaire. */
export type MbtiCounts = Record<MbtiLetter, number>;

/** Dichotomies in type-assembly order. On a tie the SECOND letter wins (legacy rule). */
const DICHOTOMIES: ReadonlyArray<readonly [MbtiLetter, MbtiLetter]> = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];

export interface DichotomyResult {
  first: MbtiLetter;
  second: MbtiLetter;
  firstCount: number;
  secondCount: number;
  winner: MbtiLetter;
  tie: boolean;
}

export interface MbtiResult {
  /** Four-letter type, e.g. 'ENFP'. */
  type: string;
  dichotomies: DichotomyResult[];
}

export function scoreMbti(counts: MbtiCounts): MbtiResult {
  const dichotomies = DICHOTOMIES.map(([first, second]) => {
    const firstCount = counts[first];
    const secondCount = counts[second];
    if (firstCount < 0 || secondCount < 0) {
      throw new ScoringError(`Negative MBTI count for dichotomy ${first}/${second}`);
    }
    const tie = firstCount === secondCount;
    const winner = firstCount > secondCount ? first : second;
    return { first, second, firstCount, secondCount, winner, tie };
  });
  return { type: dichotomies.map((d) => d.winner).join(''), dichotomies };
}

/**
 * Legacy P1-P5 personality sets: each set groups a number of four-letter types.
 * Membership is reference data (D-04).
 */
export interface PersonalitySet {
  id: string;
  types: string[];
}

export function selectPersonalitySet(type: string, sets: PersonalitySet[]): PersonalitySet {
  const upper = type.toUpperCase();
  const matches = sets.filter((s) => s.types.some((t) => t.toUpperCase() === upper));
  if (matches.length === 0) {
    throw new ScoringError(`No personality set contains type ${type}`);
  }
  if (matches.length > 1) {
    throw new ScoringError(
      `Type ${type} appears in multiple personality sets: ${matches.map((m) => m.id).join(', ')}`,
    );
  }
  return matches[0]!;
}
