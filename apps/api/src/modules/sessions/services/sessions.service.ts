import { Injectable } from '@nestjs/common';
import { type Employee, Prisma, type WorkSession } from '@prisma/client';
import type {
  ActiveSessionResponse,
  EndSessionInput,
  LocationFix,
  SessionMutationResponse,
  StartSessionInput,
  WorkSessionDto,
} from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { qualityFor } from '../../../common/utils/location-quality.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from './current-employee.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Work sessions for the signed-in employee. One ACTIVE session at most (DB-enforced). */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  async active(auth: AuthContext): Promise<ActiveSessionResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const session = await this.prisma.workSession.findFirst({
      where: { employeeId: employee.id, status: 'ACTIVE' },
    });
    return {
      session: session ? await this.toDto(session) : null,
      serverTime: new Date().toISOString(),
    };
  }

  async start(auth: AuthContext, input: StartSessionInput): Promise<SessionMutationResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const now = new Date();
    try {
      const session = await this.prisma.$transaction(async (tx) => {
        const created = await tx.workSession.create({
          data: {
            companyId: employee.companyId,
            employeeId: employee.id,
            startedAtServer: now,
            startedAtDevice: new Date(input.deviceTime),
          },
        });
        if (input.initialLocation) {
          await tx.locationPoint.createMany({
            data: [this.point(employee, created.id, input.initialLocation, 'START', now)],
            skipDuplicates: true,
          });
        }
        return created;
      });
      return { session: await this.toDto(session), serverTime: now.toISOString() };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const running = await this.prisma.workSession.findFirst({
          where: { employeeId: employee.id, status: 'ACTIVE' },
        });
        if (running) {
          throw new AppError(
            409,
            'SESSION_ALREADY_ACTIVE',
            'You already have a work session running.',
            {
              session: await this.toDto(running),
            },
          );
        }
      }
      throw e;
    }
  }

  async end(
    auth: AuthContext,
    sessionId: string,
    input: EndSessionInput,
  ): Promise<SessionMutationResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const notFound = new AppError(404, 'NOT_FOUND', 'Work session not found.');
    if (!UUID.test(sessionId)) throw notFound;
    const session = await this.prisma.workSession.findFirst({
      where: { id: sessionId, employeeId: employee.id },
    });
    if (!session) throw notFound;

    const now = new Date();
    // An end made offline reaches us late; trust the tap time, but only inside [start, now].
    const requested = input.endedAt ? new Date(input.endedAt) : now;
    const endedAt = new Date(
      Math.min(Math.max(requested.getTime(), session.startedAtServer.getTime()), now.getTime()),
    );
    const totalMinutes = Math.round((endedAt.getTime() - session.startedAtServer.getTime()) / 60_000);

    const ended = await this.prisma.$transaction(async (tx) => {
      // Conditional update: two simultaneous End taps can't both succeed.
      const claimed = await tx.workSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: {
          status: 'COMPLETED',
          endedAtServer: endedAt,
          endedAtDevice: new Date(input.deviceTime),
          totalMinutes,
        },
      });
      if (claimed.count === 0) {
        throw new AppError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.');
      }
      if (input.finalLocation) {
        await tx.locationPoint.createMany({
          data: [this.point(employee, session.id, input.finalLocation, 'END', now)],
          skipDuplicates: true,
        });
      }
      return tx.workSession.findUniqueOrThrow({ where: { id: session.id } });
    });
    return { session: await this.toDto(ended), serverTime: now.toISOString() };
  }

  private point(
    employee: Employee,
    sessionId: string,
    fix: LocationFix,
    source: 'START' | 'END',
    now: Date,
  ): Prisma.LocationPointCreateManyInput {
    const capturedAt = new Date(fix.capturedAt);
    return {
      companyId: employee.companyId,
      employeeId: employee.id,
      sessionId,
      clientPointId: fix.clientPointId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyMeters: fix.accuracyMeters ?? null,
      batteryLevel: fix.batteryLevel ?? null,
      source,
      capturedAt,
      qualityFlag: qualityFor(fix.accuracyMeters, capturedAt, now),
    };
  }

  private async toDto(s: WorkSession): Promise<WorkSessionDto> {
    const last = await this.prisma.locationPoint.aggregate({
      where: { sessionId: s.id },
      _max: { capturedAt: true },
    });
    return {
      id: s.id,
      status: s.status,
      startedAt: s.startedAtServer.toISOString(),
      endedAt: s.endedAtServer?.toISOString() ?? null,
      totalMinutes: s.totalMinutes,
      lastLocationAt: last._max.capturedAt?.toISOString() ?? null,
    };
  }
}
