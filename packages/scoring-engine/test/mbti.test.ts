import { describe, expect, it } from 'vitest';
import {
  scoreMbti,
  selectPersonalitySet,
  ScoringError,
  type MbtiCounts,
  type PersonalitySet,
} from '../src';

const counts = (partial: Partial<MbtiCounts>): MbtiCounts => ({
  E: 0,
  I: 0,
  S: 0,
  N: 0,
  T: 0,
  F: 0,
  J: 0,
  P: 0,
  ...partial,
});

describe('MBTI scoring', () => {
  it('picks the pole with the higher count per dichotomy', () => {
    const result = scoreMbti(counts({ E: 12, I: 8, S: 9, N: 11, T: 14, F: 6, J: 7, P: 13 }));
    expect(result.type).toBe('ENTP');
    expect(result.dichotomies.map((d) => d.winner)).toEqual(['E', 'N', 'T', 'P']);
    expect(result.dichotomies.every((d) => !d.tie)).toBe(true);
  });

  it('breaks ties toward the second letter of each dichotomy', () => {
    const result = scoreMbti(counts({ E: 10, I: 10, S: 5, N: 5, T: 8, F: 8, J: 9, P: 9 }));
    expect(result.type).toBe('INFP');
    expect(result.dichotomies.every((d) => d.tie)).toBe(true);
  });

  it('mixes decided and tied dichotomies', () => {
    const result = scoreMbti(counts({ E: 12, I: 8, S: 9, N: 11, T: 10, F: 10, J: 7, P: 13 }));
    expect(result.type).toBe('ENFP');
    expect(result.dichotomies[2]).toMatchObject({ winner: 'F', tie: true });
  });

  it('rejects negative counts', () => {
    expect(() => scoreMbti(counts({ E: -1 }))).toThrow(ScoringError);
  });
});

describe('personality set selection (P1-P5)', () => {
  const sets: PersonalitySet[] = [
    { id: 'P1', types: ['ENFP', 'ENFJ', 'INFP'] },
    { id: 'P2', types: ['ENTP', 'INTJ'] },
    { id: 'P3', types: ['ISTJ', 'ESTJ'] },
  ];

  it('finds the set containing the type', () => {
    expect(selectPersonalitySet('ENFP', sets).id).toBe('P1');
    expect(selectPersonalitySet('intj', sets).id).toBe('P2');
  });

  it('throws when no set matches', () => {
    expect(() => selectPersonalitySet('ISFP', sets)).toThrow(/No personality set/);
  });

  it('throws when membership is ambiguous', () => {
    const broken = [...sets, { id: 'P4', types: ['ENFP'] }];
    expect(() => selectPersonalitySet('ENFP', broken)).toThrow(/multiple personality sets/);
  });
});
