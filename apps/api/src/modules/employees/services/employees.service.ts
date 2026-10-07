import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EmployeeDetail, EmployeeListItem, EmployeeListResponse, EmployeeStatus } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';

export type EmployeeListQuery = {
  query?: string;
  status?: EmployeeStatus;
  page: number;
  pageSize: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const select = {
  id: true,
  name: true,
  designation: true,
  employeeCode: true,
  email: true,
  userId: true,
  sessions: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 },
} satisfies Prisma.EmployeeSelect;

const detailSelect = {
  ...select,
  phone: true,
  createdAt: true,
  sessions: { where: { status: 'ACTIVE' as const }, select: { id: true, startedAtServer: true }, take: 1 },
} satisfies Prisma.EmployeeSelect;

type Row = Prisma.EmployeeGetPayload<{ select: typeof select }>;
type DetailRow = Prisma.EmployeeGetPayload<{ select: typeof detailSelect }>;

const toItem = (r: Row | DetailRow): EmployeeListItem => ({
  id: r.id,
  name: r.name,
  designation: r.designation,
  employeeCode: r.employeeCode,
  email: r.email,
  status: r.sessions.length ? 'WORKING' : 'OFF_DUTY',
  account: r.userId ? 'ACTIVE' : 'INVITED',
});

/** Employee reads. Every query is scoped to the caller's company. */
@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, q: EmployeeListQuery): Promise<EmployeeListResponse> {
    const where: Prisma.EmployeeWhereInput = { companyId };
    if (q.query) where.name = { contains: q.query, mode: 'insensitive' };
    if (q.status === 'WORKING') where.sessions = { some: { status: 'ACTIVE' } };
    if (q.status === 'OFF_DUTY') where.sessions = { none: { status: 'ACTIVE' } };

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: rows.map(toItem), page: q.page, pageSize: q.pageSize, total };
  }

  async get(companyId: string, id: string): Promise<EmployeeDetail> {
    // Another company's id and a garbage id look identical: no hint that the record exists.
    const notFound = new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (!UUID.test(id)) throw notFound;
    const row = await this.prisma.employee.findFirst({ where: { id, companyId }, select: detailSelect });
    if (!row) throw notFound;
    const last = await this.prisma.locationPoint.findFirst({ where: { employeeId: row.id }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } });
    return {
      ...toItem(row),
      phone: row.phone,
      joinedAt: row.createdAt.toISOString(),
      workingSince: row.sessions[0]?.startedAtServer.toISOString() ?? null,
      lastSeenAt: last?.capturedAt.toISOString() ?? null,
    };
  }
}
