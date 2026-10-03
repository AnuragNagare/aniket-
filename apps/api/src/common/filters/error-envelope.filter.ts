import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

const isEnvelope = (body: unknown): boolean =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as { error?: unknown }).error === 'object' &&
  (body as { error: unknown }).error !== null;

/** Renders every error, ours or Nest's, in the API contract's error envelope. */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Our AppError already carries the envelope. Nest's built-ins also have an `error`
      // key, but as a string ("Not Found"), so only an object counts as an envelope.
      if (isEnvelope(body)) return res.status(status).json(body);
      const raw =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? 'Request failed.');
      return res
        .status(status)
        .json({ error: { code: CODES[status] ?? 'ERROR', message, details: {} } });
    }
    this.logger.error(exception);
    return res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side. Try again.',
        details: {},
      },
    });
  }
}
