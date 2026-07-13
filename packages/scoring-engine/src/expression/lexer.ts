import { ExpressionSyntaxError } from './errors';

export type TokenType =
  | 'number'
  | 'string'
  | 'identifier'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATOR_START = new Set(['<', '>', '=', '!', '&', '|', '+', '-', '*', '/', '%']);
const TWO_CHAR_OPS = new Set(['<=', '>=', '==', '!=', '<>', '&&', '||']);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j += 1;
      const text = source.slice(i, j);
      if ((text.match(/\./g) ?? []).length > 1) {
        throw new ExpressionSyntaxError(`Invalid number '${text}'`, i);
      }
      tokens.push({ type: 'number', value: text, pos: i });
      i = j;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += 1;
      if (j >= source.length) {
        throw new ExpressionSyntaxError('Unterminated string literal', i);
      }
      tokens.push({ type: 'string', value: source.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j += 1;
      tokens.push({ type: 'identifier', value: source.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (OPERATOR_START.has(ch)) {
      const two = source.slice(i, i + 2);
      if (TWO_CHAR_OPS.has(two)) {
        tokens.push({ type: 'operator', value: two, pos: i });
        i += 2;
        continue;
      }
      tokens.push({ type: 'operator', value: ch, pos: i });
      i += 1;
      continue;
    }
    throw new ExpressionSyntaxError(`Unexpected character '${ch}'`, i);
  }
  tokens.push({ type: 'eof', value: '', pos: source.length });
  return tokens;
}
