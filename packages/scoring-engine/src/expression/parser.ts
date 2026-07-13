import type { BinaryOp, Expr } from './ast';
import { ExpressionSyntaxError } from './errors';
import { tokenize, type Token } from './lexer';

const COMPARISON_OPS = new Map<string, BinaryOp>([
  ['<', '<'],
  ['<=', '<='],
  ['>', '>'],
  ['>=', '>='],
  ['=', '='],
  ['==', '='],
  ['!=', '!='],
  ['<>', '!='],
]);

export function parse(source: string): Expr {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = (): Token => tokens[pos]!;
  const next = (): Token => tokens[pos++]!;

  const isKeyword = (t: Token, kw: string): boolean =>
    t.type === 'identifier' && t.value.toUpperCase() === kw;

  function parseOr(): Expr {
    let left = parseAnd();
    for (;;) {
      const t = peek();
      if ((t.type === 'operator' && t.value === '||') || isKeyword(t, 'OR')) {
        next();
        left = { kind: 'binary', op: 'or', left, right: parseAnd() };
      } else {
        return left;
      }
    }
  }

  function parseAnd(): Expr {
    let left = parseNot();
    for (;;) {
      const t = peek();
      if ((t.type === 'operator' && t.value === '&&') || isKeyword(t, 'AND')) {
        next();
        left = { kind: 'binary', op: 'and', left, right: parseNot() };
      } else {
        return left;
      }
    }
  }

  function parseNot(): Expr {
    const t = peek();
    if ((t.type === 'operator' && t.value === '!') || isKeyword(t, 'NOT')) {
      next();
      return { kind: 'unary', op: 'not', operand: parseNot() };
    }
    return parseComparison();
  }

  function parseComparison(): Expr {
    let left = parseAdditive();
    for (;;) {
      const t = peek();
      const op = t.type === 'operator' ? COMPARISON_OPS.get(t.value) : undefined;
      if (op === undefined) return left;
      next();
      left = { kind: 'binary', op, left, right: parseAdditive() };
    }
  }

  function parseAdditive(): Expr {
    let left = parseMultiplicative();
    for (;;) {
      const t = peek();
      if (t.type === 'operator' && (t.value === '+' || t.value === '-')) {
        next();
        left = { kind: 'binary', op: t.value, left, right: parseMultiplicative() };
      } else {
        return left;
      }
    }
  }

  function parseMultiplicative(): Expr {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t.type === 'operator' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        next();
        left = { kind: 'binary', op: t.value as BinaryOp, left, right: parseUnary() };
      } else {
        return left;
      }
    }
  }

  function parseUnary(): Expr {
    const t = peek();
    if (t.type === 'operator' && t.value === '-') {
      next();
      return { kind: 'unary', op: '-', operand: parseUnary() };
    }
    if (t.type === 'operator' && t.value === '+') {
      next();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): Expr {
    const t = next();
    if (t.type === 'number') {
      return { kind: 'number', value: Number(t.value) };
    }
    if (t.type === 'string') {
      return { kind: 'string', value: t.value };
    }
    if (t.type === 'identifier') {
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE') return { kind: 'boolean', value: true };
      if (upper === 'FALSE') return { kind: 'boolean', value: false };
      if (peek().type === 'lparen') {
        next();
        const args: Expr[] = [];
        if (peek().type !== 'rparen') {
          for (;;) {
            args.push(parseOr());
            if (peek().type === 'comma') {
              next();
              continue;
            }
            break;
          }
        }
        const close = next();
        if (close.type !== 'rparen') {
          throw new ExpressionSyntaxError("Expected ')' to close argument list", close.pos);
        }
        return { kind: 'call', name: upper, args };
      }
      return { kind: 'identifier', name: upper };
    }
    if (t.type === 'lparen') {
      const inner = parseOr();
      const close = next();
      if (close.type !== 'rparen') {
        throw new ExpressionSyntaxError("Expected ')'", close.pos);
      }
      return inner;
    }
    throw new ExpressionSyntaxError(`Unexpected token '${t.value || t.type}'`, t.pos);
  }

  const expr = parseOr();
  const end = peek();
  if (end.type !== 'eof') {
    throw new ExpressionSyntaxError(`Unexpected trailing input '${end.value}'`, end.pos);
  }
  return expr;
}
