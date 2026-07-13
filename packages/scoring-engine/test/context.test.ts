import { describe, expect, it } from 'vitest';
import { buildCandidateBindings, scoreMbti, type MbtiCounts } from '../src';

const counts: MbtiCounts = { E: 12, I: 8, S: 9, N: 11, T: 10, F: 10, J: 7, P: 13 };

describe('buildCandidateBindings', () => {
  it('assembles AGE, GENDER, scale tokens, MBTI letters, and TYPE', () => {
    const bindings = buildCandidateBindings({
      age: 16,
      gender: 'm',
      aptitude: [{ scale: 'ws1', raw: 23, sten: 8, classification: 'H' }],
      interests: [{ scale: 'I001', raw: 11, score: 7.33, classification: 'H' }],
      mbti: scoreMbti(counts),
      extra: { oc26: 3, P072: 1 },
    });

    expect(bindings.AGE).toBe(16);
    expect(bindings.GENDER).toBe('M');
    expect(bindings.WS1).toBe(8);
    expect(bindings.I001).toBe(7.33);
    expect(bindings.TYPE).toBe('ENFP');
    expect(bindings.E).toBe(12);
    expect(bindings.P).toBe(13);
    expect(bindings.OC26).toBe(3);
    expect(bindings.P072).toBe(1);
  });

  it('lets extra tokens override derived ones and tolerates sparse input', () => {
    expect(buildCandidateBindings({})).toEqual({});
    const bindings = buildCandidateBindings({
      age: 16,
      extra: { AGE: 17 },
    });
    expect(bindings.AGE).toBe(17);
  });
});
