import { Injectable } from '@nestjs/common';
import { Prisma, type WorkUpdate } from '@prisma/client';
import type { CreateUpdateInput, CreateUpdateResponse, UpdateCategory, WorkUpdateDto } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from '../../sessions/services/current-employee.service.js';

const WINDOW_SLACK_MS = 2 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const toUpdateDto = (u: WorkUpdate): WorkUpdateDto => ({
  id: u.id,
  clientUpdateId: u.clientUpdateId,
  sessionId: u.sessionId,
  text: u.text,
  inputMethod: u.inputMethod,
  category: (u.category as UpdateCategory | null) ?? null,
  submittedAt: u.submittedAt.toISOString(),
  summaryStatus: u.summaryStatus,
  aiSummary:
    u.summaryStatus === 'COMPLETE' && (u as { aiStructuredData?: unknown }).aiStructuredData
      ? ((u as { aiStructuredData?: unknown }).aiStructuredData as WorkUpdateDto['aiSummary'])
      : null,
});

/** Work updates from the field. Idempotent per (employee, clientUpdateId). */
@Injectable()
export class UpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  async create(auth: AuthContext, input: CreateUpdateInput): Promise<CreateUpdateResponse> {
    const employee = await this.currentEmployee.forAuth(auth);

    const existing = await this.prisma.workUpdate.findUnique({
      where: { employeeId_clientUpdateId: { employeeId: employee.id, clientUpdateId: input.clientUpdateId } },
    });
    if (existing) return { update: toUpdateDto(existing), duplicate: true };

    const session = UUID.test(input.sessionId)
      ? await this.prisma.workSession.findFirst({ where: { id: input.sessionId, employeeId: employee.id } })
      : null;
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Work session not found.');

    const now = new Date();
    const submittedAt = new Date(Math.min(Date.parse(input.submittedAt), now.getTime()));
    const from = session.startedAtServer.getTime() - WINDOW_SLACK_MS;
    const to = (session.endedAtServer ?? now).getTime() + WINDOW_SLACK_MS;
    if (submittedAt.getTime() < from || submittedAt.getTime() > to) {
      throw new AppError(409, 'SESSION_NOT_ACTIVE', 'Start work before adding an update.');
    }

    try {
      const created = await this.prisma.workUpdate.create({
        data: {
          companyId: employee.companyId,
          employeeId: employee.id,
          sessionId: session.id,
          clientUpdateId: input.clientUpdateId,
          text: input.text,
          inputMethod: input.inputMethod,
          category: input.category ?? null,
          submittedAt,
        },
      });
      return { update: toUpdateDto(created), duplicate: false };
    } catch (e) {
      // Two copies of the same update arrived at the same moment.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const row = await this.prisma.workUpdate.findUniqueOrThrow({
          where: { employeeId_clientUpdateId: { employeeId: employee.id, clientUpdateId: input.clientUpdateId } },
        });
        return { update: toUpdateDto(row), duplicate: true };
      }
      throw e;
    }
  }
}
