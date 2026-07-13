export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '<'
  | '<='
  | '>'
  | '>='
  | '='
  | '!='
  | 'and'
  | 'or';

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; op: '-' | 'not'; operand: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'call'; name: string; args: Expr[] };
