import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LocationBatchInput, LocationBatchResponse, RejectedPoint } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { qualityFor } from '../../../common/utils/location-quality.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from './current-employee.service.js';

/** Clock wiggle allowed between phone and server at the edges of a session. */
const WINDOW_SLACK_MS = 2 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  /**
   * Stores queued background points. Idempotent per point via the unique
   * (employee_id, client_point_id) index, so whole-batch retries are safe.
   */
  async batch(auth: AuthContext, input: LocationBatchInput): Promise<LocationBatchResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const session = UUID.test(input.sessionId)
      ? await this.prisma.workSession.findFirst({ where: { id: input.sessionId, employeeId: employee.id } })
      : null;
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Work session not found.');

    const now = new Date();
    const from = session.startedAtServer.getTime() - WINDOW_SLACK_MS;
    const to = (session.endedAtServer ?? now).getTime() + WINDOW_SLACK_MS;

    const rejected: RejectedPoint[] = [];
    const rows: Prisma.LocationPointCreateManyInput[] = [];
    for (const p of input.points) {
      const capturedAt = new Date(p.capturedAt);
      if (capturedAt.getTime() < from || capturedAt.getTime() > to) {
        rejected.push({ clientPointId: p.clientPointId, reason: 'OUTSIDE_SESSION' });
        continue;
      }
      rows.push({
        companyId: employee.companyId,
        employeeId: employee.id,
        sessionId: session.id,
        clientPointId: p.clientPointId,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyMeters: p.accuracyMeters ?? null,
        speedMps: p.speedMps ?? null,
        bearing: p.bearing ?? null,
        batteryLevel: p.batteryLevel ?? null,
        source: p.source,
        capturedAt,
        qualityFlag: qualityFor(p.accuracyMeters, capturedAt, now),
      });
    }

    const created = rows.length
      ? await this.prisma.locationPoint.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };
    const last = await this.prisma.locationPoint.aggregate({
      where: { sessionId: session.id },
      _max: { capturedAt: true },
    });
    return {
      accepted: created.count,
      duplicates: rows.length - created.count,
      rejected,
      lastLocationAt: last._max.capturedAt?.toISOString() ?? null,
    };
  }
}
