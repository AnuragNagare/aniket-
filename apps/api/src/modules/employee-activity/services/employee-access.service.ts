import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Finds an employee inside the admin's company. Another company's id looks exactly like a missing one. */
@Injectable()
export class EmployeeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async find(companyId: string, employeeId: string) {
    const notFound = new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (!UUID.test(employeeId)) throw notFound;
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { company: true },
    });
    if (!employee) throw notFound;
    return employee;
  }
}
