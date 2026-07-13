import { describe, expect, it } from 'vitest';
import { evaluateRules, ScoringError, type WideRule } from '../src';

const bindings = { WS1: 8, P: 13, J: 7, GENDER: 'M', AGE: 16 };

const rules: WideRule<{ tag: string }>[] = [
  { id: 'R1', when: 'WS1 >= 8 AND P > J', result: { tag: 'STEM' }, priority: 2 },
  { id: 'R2', when: "GENDER = 'F'", result: { tag: 'X' }, priority: 1 },
  { id: 'R3', when: 'AGE >= 15', result: { tag: 'SENIOR' }, priority: 1 },
];

describe('wide-condition rule engine', () => {
  it("returns all matches in priority order (mode 'all')", () => {
    const matches = evaluateRules(rules, bindings);
    expect(matches.map((m) => m.id)).toEqual(['R3', 'R1']);
    expect(matches[0]!.result.tag).toBe('SENIOR');
  });

  it("stops at the first match (mode 'first')", () => {
    const matches = evaluateRules(rules, bindings, { mode: 'first' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe('R3');
  });

  it('breaks priority ties by rule id', () => {
    const tied: WideRule[] = [
      { id: 'B', when: 'TRUE', result: {} },
      { id: 'A', when: 'TRUE', result: {} },
    ];
    expect(evaluateRules(tied, {}).map((m) => m.id)).toEqual(['A', 'B']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(evaluateRules(rules, { ...bindings, WS1: 1, AGE: 10 })).toEqual([]);
  });

  it('wraps evaluation failures with the rule id', () => {
    const broken: WideRule[] = [{ id: 'RX', when: 'NOPE > 1', result: {} }];
    expect(() => evaluateRules(broken, bindings)).toThrow(ScoringError);
    expect(() => evaluateRules(broken, bindings)).toThrow(/Rule RX/);
  });
});
