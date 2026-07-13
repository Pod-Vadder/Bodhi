export class TestEngineError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'TestEngineError';
  }
}

export class AttemptLimitError extends TestEngineError {
  constructor(max: number) {
    super(`Attempt limit of ${max} reached; assessment is locked (BR-12)`, 'ATTEMPT_LIMIT');
  }
}

export class AttemptNotFoundError extends TestEngineError {
  constructor(id: string) {
    super(`Attempt ${id} not found`, 'ATTEMPT_NOT_FOUND');
  }
}

export class ModuleSequenceError extends TestEngineError {
  constructor(message: string) {
    super(`${message} (BR-13)`, 'MODULE_SEQUENCE');
  }
}

export class TimerExpiredError extends TestEngineError {
  constructor() {
    super('The module timer has expired', 'TIMER_EXPIRED');
  }
}

export class AttemptStateError extends TestEngineError {
  constructor(message: string) {
    super(message, 'ATTEMPT_STATE');
  }
}
