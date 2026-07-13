import { describe, expect, it } from 'vitest';
import { classifyInterest, scoreInterest, scoreInterests, ScoringError } from '../src';

describe('interest scoring', () => {
  it('applies the legacy formula (sum / 15) * 10', () => {
    const responses = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0];
    const score = scoreInterest({ scale: 'I001', responses });
    expect(score.raw).toBe(11);
    expect(score.score).toBeCloseTo(7.333333333, 8);
    expect(score.classification).toBe('H');
  });

  it('supports custom divisor/multiplier and rounding', () => {
    const score = scoreInterest(
      { scale: 'I002', responses: [2, 2, 3] },
      { divisor: 21, multiplier: 10, roundDigits: 2 },
    );
    expect(score.score).toBe(3.33);
    expect(score.classification).toBe('L');
  });

  it('rejects a zero divisor', () => {
    expect(() => scoreInterest({ scale: 'I001', responses: [1] }, { divisor: 0 })).toThrow(
      ScoringError,
    );
  });

  it('classifies against configurable bands', () => {
    expect(classifyInterest(3.99)).toBe('L');
    expect(classifyInterest(4)).toBe('M');
    expect(classifyInterest(6.99)).toBe('M');
    expect(classifyInterest(7)).toBe('H');
    expect(classifyInterest(5, { lowUpper: 6, highLower: 8 })).toBe('L');
  });

  it('scores batches', () => {
    const scores = scoreInterests([
      { scale: 'I001', responses: [1, 1, 1] },
      { scale: 'I002', responses: [0, 0, 0] },
    ]);
    expect(scores.map((s) => s.scale)).toEqual(['I001', 'I002']);
    expect(scores[0]!.score).toBeCloseTo(2, 8);
    expect(scores[1]!.score).toBe(0);
  });
});
