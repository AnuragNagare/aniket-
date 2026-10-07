import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { type LocationBatchInput, LocationBatchSchema } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { LocationsService } from '../services/locations.service.js';

@Roles('EMPLOYEE')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('batch')
  @HttpCode(200)
  batch(
    @CurrentAuth() auth: AuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodBody(LocationBatchSchema)) body: LocationBatchInput,
  ) {
    // De-duplication is per point (client_point_id); the key is required by the API
    // contract so clients always retry with the same batch identity.
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with each batch.');
    }
    return this.locations.batch(auth, body);
  }
}
