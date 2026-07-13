export type { BinaryOp, Expr } from './ast';
export { ExpressionEvaluationError, ExpressionSyntaxError } from './errors';
export { parse } from './parser';
export {
  compile,
  evaluate,
  evaluateBoolean,
  evaluateNumber,
  extractIdentifiers,
  type CompiledExpression,
  type Value,
  type VariableBindings,
} from './evaluator';
