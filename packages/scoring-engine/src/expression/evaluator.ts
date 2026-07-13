import type { Expr } from './ast';
import { ExpressionEvaluationError } from './errors';
import { parse } from './parser';

export type Value = number | string | boolean;

/** Variable bindings; keys are matched case-insensitively (legacy tokens appear in mixed case). */
export type VariableBindings = Record<string, Value>;

export interface CompiledExpression {
  source: string;
  ast: Expr;
  /** Every identifier referenced by the expression, uppercased and deduplicated. */
  identifiers: string[];
  evaluate(bindings?: VariableBindings): Value;
}

function typeName(v: Value): string {
  return typeof v;
}

function asNumber(v: Value, context: string): number {
  if (typeof v !== 'number') {
    throw new ExpressionEvaluationError(`${context} requires a number, got ${typeName(v)}`);
  }
  return v;
}

function truthy(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  throw new ExpressionEvaluationError(`Cannot use a string as a boolean condition`);
}

function valuesEqual(a: Value, b: Value): boolean {
  if (typeof a !== typeof b) {
    throw new ExpressionEvaluationError(`Cannot compare ${typeName(a)} with ${typeName(b)}`);
  }
  return a === b;
}

function compareOrdered(a: Value, b: Value, op: '<' | '<=' | '>' | '>='): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (op === '<') return a < b;
    if (op === '<=') return a <= b;
    if (op === '>') return a > b;
    return a >= b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (op === '<') return a < b;
    if (op === '<=') return a <= b;
    if (op === '>') return a > b;
    return a >= b;
  }
  throw new ExpressionEvaluationError(
    `Operator '${op}' requires two numbers or two strings, got ${typeName(a)} and ${typeName(b)}`,
  );
}

function roundHalfAwayFromZero(x: number, digits: number): number {
  const factor = 10 ** digits;
  return (Math.sign(x) * Math.round(Math.abs(x) * factor)) / factor;
}

type FunctionImpl = (args: Value[]) => Value;

function requireArgs(name: string, args: Value[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    const expected = min === max ? `${min}` : `${min}-${max}`;
    throw new ExpressionEvaluationError(
      `Function ${name} expects ${expected} argument(s), got ${args.length}`,
    );
  }
}

const FUNCTIONS: Record<string, FunctionImpl> = {
  ABS: (args) => {
    requireArgs('ABS', args, 1);
    return Math.abs(asNumber(args[0]!, 'ABS'));
  },
  MIN: (args) => {
    if (args.length === 0) throw new ExpressionEvaluationError('MIN expects at least 1 argument');
    return Math.min(...args.map((a) => asNumber(a, 'MIN')));
  },
  MAX: (args) => {
    if (args.length === 0) throw new ExpressionEvaluationError('MAX expects at least 1 argument');
    return Math.max(...args.map((a) => asNumber(a, 'MAX')));
  },
  ROUND: (args) => {
    requireArgs('ROUND', args, 1, 2);
    const digits = args.length === 2 ? asNumber(args[1]!, 'ROUND digits') : 0;
    return roundHalfAwayFromZero(asNumber(args[0]!, 'ROUND'), digits);
  },
  FLOOR: (args) => {
    requireArgs('FLOOR', args, 1);
    return Math.floor(asNumber(args[0]!, 'FLOOR'));
  },
  CEIL: (args) => {
    requireArgs('CEIL', args, 1);
    return Math.ceil(asNumber(args[0]!, 'CEIL'));
  },
  CEILING: (args) => {
    requireArgs('CEILING', args, 1);
    return Math.ceil(asNumber(args[0]!, 'CEILING'));
  },
  IN: (args) => {
    if (args.length < 2) throw new ExpressionEvaluationError('IN expects at least 2 arguments');
    const [needle, ...haystack] = args;
    return haystack.some((v) => typeof v === typeof needle && v === needle);
  },
  BETWEEN: (args) => {
    requireArgs('BETWEEN', args, 3);
    const x = asNumber(args[0]!, 'BETWEEN');
    return x >= asNumber(args[1]!, 'BETWEEN') && x <= asNumber(args[2]!, 'BETWEEN');
  },
};

export function compile(source: string): CompiledExpression {
  const ast = parse(source);
  const identifiers = collectIdentifiers(ast);

  function evalNode(node: Expr, bindings: VariableBindings, lookup: Map<string, Value>): Value {
    switch (node.kind) {
      case 'number':
      case 'string':
      case 'boolean':
        return node.value;
      case 'identifier': {
        const value = lookup.get(node.name);
        if (value === undefined) {
          throw new ExpressionEvaluationError(
            `Unknown variable '${node.name}' in expression '${source}'`,
          );
        }
        return value;
      }
      case 'unary': {
        if (node.op === '-') {
          return -asNumber(evalNode(node.operand, bindings, lookup), "unary '-'");
        }
        return !truthy(evalNode(node.operand, bindings, lookup));
      }
      case 'binary': {
        if (node.op === 'and') {
          return truthy(evalNode(node.left, bindings, lookup))
            ? truthy(evalNode(node.right, bindings, lookup))
            : false;
        }
        if (node.op === 'or') {
          return truthy(evalNode(node.left, bindings, lookup))
            ? true
            : truthy(evalNode(node.right, bindings, lookup));
        }
        const left = evalNode(node.left, bindings, lookup);
        const right = evalNode(node.right, bindings, lookup);
        switch (node.op) {
          case '+':
            return asNumber(left, "'+'") + asNumber(right, "'+'");
          case '-':
            return asNumber(left, "'-'") - asNumber(right, "'-'");
          case '*':
            return asNumber(left, "'*'") * asNumber(right, "'*'");
          case '/': {
            const divisor = asNumber(right, "'/'");
            if (divisor === 0) throw new ExpressionEvaluationError('Division by zero');
            return asNumber(left, "'/'") / divisor;
          }
          case '%': {
            const divisor = asNumber(right, "'%'");
            if (divisor === 0) throw new ExpressionEvaluationError('Modulo by zero');
            return asNumber(left, "'%'") % divisor;
          }
          case '=':
            return valuesEqual(left, right);
          case '!=':
            return !valuesEqual(left, right);
          case '<':
          case '<=':
          case '>':
          case '>=':
            return compareOrdered(left, right, node.op);
        }
        break;
      }
      case 'call': {
        if (node.name === 'IF') {
          if (node.args.length !== 3) {
            throw new ExpressionEvaluationError(
              `Function IF expects 3 arguments, got ${node.args.length}`,
            );
          }
          const cond = truthy(evalNode(node.args[0]!, bindings, lookup));
          return evalNode(node.args[cond ? 1 : 2]!, bindings, lookup);
        }
        const fn = FUNCTIONS[node.name];
        if (!fn) {
          throw new ExpressionEvaluationError(`Unknown function '${node.name}'`);
        }
        return fn(node.args.map((a) => evalNode(a, bindings, lookup)));
      }
    }
    throw new ExpressionEvaluationError('Unreachable expression node');
  }

  return {
    source,
    ast,
    identifiers,
    evaluate(bindings: VariableBindings = {}): Value {
      const lookup = new Map<string, Value>();
      for (const [key, value] of Object.entries(bindings)) {
        lookup.set(key.toUpperCase(), value);
      }
      return evalNode(ast, bindings, lookup);
    },
  };
}

export function evaluate(source: string, bindings: VariableBindings = {}): Value {
  return compile(source).evaluate(bindings);
}

export function evaluateBoolean(source: string, bindings: VariableBindings = {}): boolean {
  return truthy(evaluate(source, bindings));
}

export function evaluateNumber(source: string, bindings: VariableBindings = {}): number {
  const result = evaluate(source, bindings);
  if (typeof result !== 'number') {
    throw new ExpressionEvaluationError(
      `Expression '${source}' evaluated to ${typeName(result)}, expected number`,
    );
  }
  return result;
}

export function extractIdentifiers(source: string): string[] {
  return compile(source).identifiers;
}

function collectIdentifiers(node: Expr, acc: Set<string> = new Set()): string[] {
  switch (node.kind) {
    case 'identifier':
      acc.add(node.name);
      break;
    case 'unary':
      collectIdentifiers(node.operand, acc);
      break;
    case 'binary':
      collectIdentifiers(node.left, acc);
      collectIdentifiers(node.right, acc);
      break;
    case 'call':
      for (const arg of node.args) collectIdentifiers(arg, acc);
      break;
    default:
      break;
  }
  return [...acc];
}
