import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

/** Validates a request body against a shared Zod schema; maps issues to `details.fields`. */
export class ZodBody<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      throw new AppError(400, 'VALIDATION_FAILED', 'Some fields need attention.', { fields });
    }
    return result.data;
  }
}
