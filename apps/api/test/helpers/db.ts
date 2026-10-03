import type { Company, Employee, PrismaClient } from '@prisma/client';

/** Empties every application table (keeps migrations) so each test starts clean. */
export async function resetDb(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

export function makeCompany(prisma: PrismaClient, overrides: Partial<Company> = {}) {
  return prisma.company.create({ data: { name: 'Test Co', ...overrides } });
}

export function makeEmployee(
  prisma: PrismaClient,
  companyId: string,
  overrides: Partial<Employee> = {},
) {
  return prisma.employee.create({ data: { companyId, name: 'Ravi Kumar', ...overrides } });
}
