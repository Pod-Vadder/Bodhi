import { evaluateBoolean, type VariableBindings } from '../expression';
import { ScoringError } from '../types';

/**
 * Generalised replacement for the legacy wide-condition tables (EMQ / RF / SE):
 * each row becomes a rule with a boolean condition over the candidate context
 * and an arbitrary result payload.
 */
export interface WideRule<T = Record<string, unknown>> {
  id: string;
  when: string;
  result: T;
  /** Evaluation order: lower priority evaluates first. Defaults to 0; ties break by id. */
  priority?: number;
}

export interface RuleMatch<T = Record<string, unknown>> {
  id: string;
  priority: number;
  result: T;
}

export interface RuleEngineOptions {
  /** 'all' returns every matching rule (default); 'first' stops at the first match. */
  mode?: 'all' | 'first';
}

export function evaluateRules<T = Record<string, unknown>>(
  rules: WideRule<T>[],
  bindings: VariableBindings,
  options: RuleEngineOptions = {},
): RuleMatch<T>[] {
  const mode = options.mode ?? 'all';
  const ordered = [...rules].sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id),
  );

  const matches: RuleMatch<T>[] = [];
  for (const rule of ordered) {
    let matched: boolean;
    try {
      matched = evaluateBoolean(rule.when, bindings);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ScoringError(`Rule ${rule.id}: ${detail}`);
    }
    if (matched) {
      matches.push({ id: rule.id, priority: rule.priority ?? 0, result: rule.result });
      if (mode === 'first') break;
    }
  }
  return matches;
}
