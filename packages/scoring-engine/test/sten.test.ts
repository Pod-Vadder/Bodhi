import { describe, expect, it } from 'vitest';
import {
  classifySten,
  lookupSten,
  scoreAptitude,
  ScoringError,
  type StenBand,
} from '../src';

const table: StenBand[] = [
  { scale: 'WS1', ageMin: 13, ageMax: 15, rawMin: 0, rawMax: 10, sten: 2 },
  { scale: 'WS1', ageMin: 13, ageMax: 15, rawMin: 11, rawMax: 30, sten: 6 },
  { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 0, rawMax: 10, sten: 3 },
  { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 11, rawMax: 20, sten: 5 },
  { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 21, rawMax: 30, sten: 8 },
  { scale: 'WS2', ageMin: 16, ageMax: 18, rawMin: 0, rawMax: 15, sten: 4 },
  { scale: 'WS2', ageMin: 16, ageMax: 18, rawMin: 16, rawMax: 30, sten: 7 },
];

describe('sten lookup', () => {
  it('selects by scale, age band, and raw range', () => {
    expect(lookupSten(table, 'WS1', 16, 23)).toBe(8);
    expect(lookupSten(table, 'WS1', 14, 23)).toBe(6);
    expect(lookupSten(table, 'WS2', 17, 12)).toBe(4);
  });

  it('is inclusive at band boundaries', () => {
    expect(lookupSten(table, 'WS1', 15, 10)).toBe(2);
    expect(lookupSten(table, 'WS1', 16, 11)).toBe(5);
    expect(lookupSten(table, 'WS1', 16, 21)).toBe(8);
  });

  it('matches scale case-insensitively', () => {
    expect(lookupSten(table, 'ws1', 16, 5)).toBe(3);
  });

  it('throws when no band covers the input', () => {
    expect(() => lookupSten(table, 'WS1', 25, 5)).toThrow(ScoringError);
    expect(() => lookupSten(table, 'WS1', 16, 31)).toThrow(/No sten band/);
    expect(() => lookupSten(table, 'WS3', 16, 5)).toThrow(ScoringError);
  });

  it('throws on ambiguous overlapping bands', () => {
    const overlapping: StenBand[] = [
      ...table,
      { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 20, rawMax: 25, sten: 9 },
    ];
    expect(() => lookupSten(overlapping, 'WS1', 16, 22)).toThrow(/Ambiguous/);
  });
});

describe('sten classification', () => {
  it('maps sten to L/M/H with default bands', () => {
    expect(classifySten(1)).toBe('L');
    expect(classifySten(3)).toBe('L');
    expect(classifySten(4)).toBe('M');
    expect(classifySten(7)).toBe('M');
    expect(classifySten(8)).toBe('H');
    expect(classifySten(10)).toBe('H');
  });

  it('accepts custom bands and rejects out-of-band stens', () => {
    expect(classifySten(4, { low: [1, 4], medium: [5, 6], high: [7, 10] })).toBe('L');
    expect(() => classifySten(11)).toThrow(ScoringError);
  });
});

describe('scoreAptitude', () => {
  it('scores a batch of scales for one candidate', () => {
    const scores = scoreAptitude(
      table,
      [
        { scale: 'WS1', raw: 23 },
        { scale: 'WS2', raw: 12 },
      ],
      16,
    );
    expect(scores).toEqual([
      { scale: 'WS1', raw: 23, sten: 8, classification: 'H' },
      { scale: 'WS2', raw: 12, sten: 4, classification: 'M' },
    ]);
  });
});
