import type { QuestionRecord } from './ports';

/** FNV-1a 32-bit hash for deterministic per-attempt seeds. */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seeded PRNG: stable order for one attempt+module, different across attempts. */
export function seededShuffle<T>(items: readonly T[], seedInput: string): T[] {
  const random = mulberry32(seedFromString(seedInput));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export interface ServedQuestion {
  id: string;
  text: string;
  options: { id: string; label: string }[];
}

/**
 * Sanitized, candidate-facing question payload: no scale codes, option
 * values, poles, or any other scoring metadata leave the server.
 */
export function serveQuestions(
  questions: QuestionRecord[],
  attemptId: string,
  moduleId: string,
  randomize: boolean,
): ServedQuestion[] {
  const ordered = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const sequence = randomize ? seededShuffle(ordered, `${attemptId}:${moduleId}`) : ordered;
  return sequence.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }));
}
