import { describe, expect, it } from 'vitest';
import {
  compile,
  evaluate,
  evaluateBoolean,
  evaluateNumber,
  extractIdentifiers,
  ExpressionEvaluationError,
  ExpressionSyntaxError,
} from '../src/expression';

describe('expression evaluator', () => {
  describe('arithmetic', () => {
    it('respects operator precedence', () => {
      expect(evaluate('2 + 3 * 4')).toBe(14);
      expect(evaluate('(2 + 3) * 4')).toBe(20);
      expect(evaluate('10 - 4 - 3')).toBe(3);
      expect(evaluate('20 / 4 / 5')).toBe(1);
      expect(evaluate('7 % 3')).toBe(1);
    });

    it('handles unary minus and plus', () => {
      expect(evaluate('-5 + 3')).toBe(-2);
      expect(evaluate('--5')).toBe(5);
      expect(evaluate('+5')).toBe(5);
      expect(evaluate('2 * -3')).toBe(-6);
    });

    it('parses decimals', () => {
      expect(evaluate('0.5 * 4')).toBe(2);
      expect(evaluate('.25 * 8')).toBe(2);
    });

    it('throws on division and modulo by zero', () => {
      expect(() => evaluate('1 / 0')).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('1 % 0')).toThrow(ExpressionEvaluationError);
    });

    it('rejects arithmetic on non-numbers', () => {
      expect(() => evaluate("'a' + 1")).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('TRUE * 2')).toThrow(ExpressionEvaluationError);
    });
  });

  describe('comparisons and equality', () => {
    it('compares numbers', () => {
      expect(evaluate('3 < 5')).toBe(true);
      expect(evaluate('5 <= 5')).toBe(true);
      expect(evaluate('3 > 5')).toBe(false);
      expect(evaluate('5 >= 6')).toBe(false);
    });

    it('supports =, ==, != and <>', () => {
      expect(evaluate('4 = 4')).toBe(true);
      expect(evaluate('4 == 4')).toBe(true);
      expect(evaluate('4 != 5')).toBe(true);
      expect(evaluate('4 <> 4')).toBe(false);
    });

    it('compares strings', () => {
      expect(evaluate("'abc' = 'abc'")).toBe(true);
      expect(evaluate("'abc' < 'abd'")).toBe(true);
      expect(evaluate('"M" = \'M\'')).toBe(true);
    });

    it('rejects mixed-type equality and ordering', () => {
      expect(() => evaluate("1 = '1'")).toThrow(ExpressionEvaluationError);
      expect(() => evaluate("1 < 'a'")).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('TRUE < FALSE')).toThrow(ExpressionEvaluationError);
    });
  });

  describe('logic', () => {
    it('supports AND/OR/NOT keywords case-insensitively', () => {
      expect(evaluate('TRUE and FALSE')).toBe(false);
      expect(evaluate('true OR false')).toBe(true);
      expect(evaluate('NOT FALSE')).toBe(true);
      expect(evaluate('not (1 > 2)')).toBe(true);
    });

    it('supports symbolic &&, ||, !', () => {
      expect(evaluate('TRUE && TRUE')).toBe(true);
      expect(evaluate('FALSE || TRUE')).toBe(true);
      expect(evaluate('!TRUE')).toBe(false);
    });

    it('binds NOT tighter than AND, and AND tighter than OR', () => {
      expect(evaluate('TRUE OR TRUE AND FALSE')).toBe(true);
      expect(evaluate('NOT 1 > 2 AND TRUE')).toBe(true);
    });

    it('short-circuits', () => {
      expect(evaluate('FALSE AND (1 / 0 > 0)')).toBe(false);
      expect(evaluate('TRUE OR (1 / 0 > 0)')).toBe(true);
    });

    it('coerces numbers to booleans in logical context, rejects strings', () => {
      expect(evaluate('1 AND 2')).toBe(true);
      expect(evaluate('0 OR 0')).toBe(false);
      expect(() => evaluate("'x' AND TRUE")).toThrow(ExpressionEvaluationError);
    });
  });

  describe('variables', () => {
    it('resolves bindings case-insensitively', () => {
      expect(evaluate('WS1 + ws2', { ws1: 3, WS2: 4 })).toBe(7);
      expect(evaluate("GENDER = 'M'", { Gender: 'M' })).toBe(true);
    });

    it('handles legacy token shapes', () => {
      const bindings = { WS1: 8, OC26: 3, P072: 1, I108: 6.5, AGE: 16, GENDER: 'F', E: 12, P: 9 };
      expect(evaluate('WS1 >= 6 AND OC26 < 5', bindings)).toBe(true);
      expect(evaluate("I108 > 6 AND GENDER = 'F'", bindings)).toBe(true);
      expect(evaluate('P072 = 1 AND E > P', bindings)).toBe(true);
    });

    it('throws a clear error on unknown variables', () => {
      expect(() => evaluate('WS9 + 1', { WS1: 2 })).toThrow(/Unknown variable 'WS9'/);
    });
  });

  describe('functions', () => {
    it('implements the whitelist', () => {
      expect(evaluate('ABS(-4)')).toBe(4);
      expect(evaluate('MIN(3, 1, 2)')).toBe(1);
      expect(evaluate('MAX(3, 1, 2)')).toBe(3);
      expect(evaluate('ROUND(2.5)')).toBe(3);
      expect(evaluate('ROUND(-2.5)')).toBe(-3);
      expect(evaluate('ROUND(2.345, 2)')).toBe(2.35);
      expect(evaluate('FLOOR(2.9)')).toBe(2);
      expect(evaluate('CEIL(2.1)')).toBe(3);
      expect(evaluate('CEILING(2.1)')).toBe(3);
      expect(evaluate('IF(1 > 0, 10, 20)')).toBe(10);
      expect(evaluate("IN('B', 'A', 'B', 'C')")).toBe(true);
      expect(evaluate('IN(4, 1, 2, 3)')).toBe(false);
      expect(evaluate('BETWEEN(5, 1, 10)')).toBe(true);
      expect(evaluate('BETWEEN(11, 1, 10)')).toBe(false);
    });

    it('is case-insensitive on function names', () => {
      expect(evaluate('abs(-2)')).toBe(2);
      expect(evaluate('if(true, 1, 2)')).toBe(1);
    });

    it('IF only evaluates the taken branch', () => {
      expect(evaluate('IF(TRUE, 1, 1 / 0)')).toBe(1);
      expect(evaluate('IF(FALSE, 1 / 0, 2)')).toBe(2);
    });

    it('rejects unknown functions and bad arity', () => {
      expect(() => evaluate('EXEC(1)')).toThrow(/Unknown function 'EXEC'/);
      expect(() => evaluate('ABS(1, 2)')).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('IF(TRUE, 1)')).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('IN(1)')).toThrow(ExpressionEvaluationError);
      expect(() => evaluate('MIN()')).toThrow(ExpressionEvaluationError);
    });
  });

  describe('syntax errors', () => {
    it('reports position and reason', () => {
      expect(() => evaluate('1 +')).toThrow(ExpressionSyntaxError);
      expect(() => evaluate('(1 + 2')).toThrow(ExpressionSyntaxError);
      expect(() => evaluate('1 2')).toThrow(/trailing input/);
      expect(() => evaluate("'unterminated")).toThrow(/Unterminated string/);
      expect(() => evaluate('1 @ 2')).toThrow(/Unexpected character/);
      expect(() => evaluate('1.2.3')).toThrow(/Invalid number/);
    });
  });

  describe('compile and helpers', () => {
    it('compiles once and evaluates many times', () => {
      const compiled = compile('WS1 * 2 + WS2');
      expect(compiled.evaluate({ WS1: 1, WS2: 1 })).toBe(3);
      expect(compiled.evaluate({ WS1: 5, WS2: 0 })).toBe(10);
      expect(compiled.identifiers.sort()).toEqual(['WS1', 'WS2']);
    });

    it('extracts identifiers, excluding function names', () => {
      expect(extractIdentifiers('MAX(WS1, ws2) + AGE').sort()).toEqual(['AGE', 'WS1', 'WS2']);
    });

    it('evaluateNumber and evaluateBoolean enforce result types', () => {
      expect(evaluateNumber('2 + 2')).toBe(4);
      expect(() => evaluateNumber('1 > 0')).toThrow(/expected number/);
      expect(evaluateBoolean('1', {})).toBe(true);
      expect(() => evaluateBoolean("'x'")).toThrow(ExpressionEvaluationError);
    });
  });
});
