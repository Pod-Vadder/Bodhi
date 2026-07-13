export class ExpressionSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(`${message} (at position ${position})`);
    this.name = 'ExpressionSyntaxError';
  }
}

export class ExpressionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionEvaluationError';
  }
}
