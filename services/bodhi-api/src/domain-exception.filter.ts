import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { AuthError } from './auth/errors';
import { TestEngineError } from './test-engine/errors';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  ACCOUNT_DISABLED: 403,
  EMAIL_IN_USE: 409,
  ATTEMPT_LIMIT: 423,
  ATTEMPT_NOT_FOUND: 404,
  MODULE_SEQUENCE: 409,
  ATTEMPT_STATE: 409,
  TIMER_EXPIRED: 410,
};

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    if (exception instanceof AuthError || exception instanceof TestEngineError) {
      const status = STATUS_BY_CODE[exception.code] ?? 400;
      response.status(status).json({ code: exception.code, message: exception.message });
      return;
    }
    console.error(exception);
    response.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
  }
}
