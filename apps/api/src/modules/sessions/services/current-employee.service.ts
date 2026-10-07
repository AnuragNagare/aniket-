import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

/** The employee record behind the signed-in user, always scoped to their company. */
@Injectable()
export class CurrentEmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async forAuth(auth: AuthContext): Promise<Employee> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: auth.userId, companyId: auth.companyId },
    });
    if (!employee) {
      throw new AppError(403, 'NOT_AN_EMPLOYEE', 'This account is not linked to an employee. Contact your company admin.');
    }
    return employee;
  }
}
