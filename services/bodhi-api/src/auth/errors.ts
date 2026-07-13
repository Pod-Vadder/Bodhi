export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class EmailInUseError extends AuthError {
  constructor(email: string) {
    super(`Email ${email} is already registered`, 'EMAIL_IN_USE');
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}

export class InvalidRefreshTokenError extends AuthError {
  constructor() {
    super('Refresh token is invalid, expired, or revoked', 'INVALID_REFRESH_TOKEN');
  }
}

export class AccountDisabledError extends AuthError {
  constructor() {
    super('Account is disabled', 'ACCOUNT_DISABLED');
  }
}
