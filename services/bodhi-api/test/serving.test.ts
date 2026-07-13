import { describe, expect, it } from 'vitest';
import { seededShuffle, seedFromString, serveQuestions } from '../src/test-engine/serving';
import type { QuestionRecord } from '../src/test-engine/ports';

const questions: QuestionRecord[] = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i + 1}`,
  questionSetId: 'qs-1',
  text: `Question ${i + 1}`,
  orderIndex: i + 1,
  options: [
    { id: `q${i + 1}-a`, label: 'Agree' },
    { id: `q${i + 1}-b`, label: 'Disagree' },
  ],
}));

describe('seeded shuffle', () => {
  it('is deterministic for the same seed', () => {
    expect(seededShuffle(questions, 'attempt-1:mod-1')).toEqual(
      seededShuffle(questions, 'attempt-1:mod-1'),
    );
    expect(seedFromString('abc')).toBe(seedFromString('abc'));
  });

  it('differs across attempts (with overwhelming probability)', () => {
    const a = seededShuffle(questions, 'attempt-1:mod-1').map((q) => q.id);
    const b = seededShuffle(questions, 'attempt-2:mod-1').map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it('preserves the element set and does not mutate the input', () => {
    const copy = [...questions];
    const shuffled = seededShuffle(questions, 'seed');
    expect(questions).toEqual(copy);
    expect([...shuffled].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      [...questions].sort((x, y) => x.id.localeCompare(y.id)),
    );
  });
});

describe('serveQuestions', () => {
  it('strips all scoring metadata from the payload', () => {
    const served = serveQuestions(questions, 'attempt-1', 'mod-1', true);
    for (const q of served) {
      expect(Object.keys(q).sort()).toEqual(['id', 'options', 'text']);
      for (const o of q.options) {
        expect(Object.keys(o).sort()).toEqual(['id', 'label']);
      }
    }
  });

  it('respects orderIndex when randomization is off', () => {
    const served = serveQuestions([...questions].reverse(), 'attempt-1', 'mod-1', false);
    expect(served.map((q) => q.id)).toEqual(questions.map((q) => q.id));
  });
});
