import { HttpException } from '@nestjs/common';

/** Domain error rendered as the API's `{ error: { code, message, details } }` envelope. */
export class AppError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super({ error: { code, message, details } }, status);
  }
}
