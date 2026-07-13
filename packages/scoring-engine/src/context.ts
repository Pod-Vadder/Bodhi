import type { VariableBindings } from './expression';
import type { AptitudeScore } from './aptitude/sten';
import type { InterestScore } from './interest/interest';
import type { MbtiResult } from './personality/mbti';

/**
 * Assembles the variable context consumed by CSR and rule expressions.
 * Token classes (WS1-10 aptitude stens, I001-I108 interest scores, OC1-26,
 * P001-P072, MBTI letters, AGE, GENDER) all resolve through this single
 * bindings map; scale codes are used verbatim as tokens.
 */
export interface CandidateContextInput {
  age?: number;
  gender?: string;
  aptitude?: AptitudeScore[];
  interests?: InterestScore[];
  mbti?: MbtiResult;
  /** Extra tokens (e.g. OC1-26, P001-P072) merged last, overriding derived bindings on collision. */
  extra?: VariableBindings;
}

export function buildCandidateBindings(input: CandidateContextInput): VariableBindings {
  const bindings: VariableBindings = {};

  if (input.age !== undefined) bindings.AGE = input.age;
  if (input.gender !== undefined) bindings.GENDER = input.gender.toUpperCase();

  for (const score of input.aptitude ?? []) {
    bindings[score.scale.toUpperCase()] = score.sten;
  }
  for (const score of input.interests ?? []) {
    bindings[score.scale.toUpperCase()] = score.score;
  }
  if (input.mbti) {
    bindings.TYPE = input.mbti.type;
    for (const d of input.mbti.dichotomies) {
      bindings[d.first] = d.firstCount;
      bindings[d.second] = d.secondCount;
    }
  }
  for (const [key, value] of Object.entries(input.extra ?? {})) {
    bindings[key.toUpperCase()] = value;
  }
  return bindings;
}
