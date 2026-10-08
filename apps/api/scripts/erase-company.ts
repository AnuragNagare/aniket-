import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/common/audit/audit.service.js';
import { LocalStorage } from '../src/common/storage/local.storage.js';
import type { FileStorage } from '../src/common/storage/file-storage.js';
import { ErasureService } from '../src/modules/privacy/services/erasure.service.js';
import { UserStatusCache } from '../src/modules/auth/services/user-status-cache.service.js';

export type EraseCompanyOptions = {
  confirm: string;
};

export async function eraseCompany(
  prisma: PrismaClient,
  storage: FileStorage,
  companyId: string,
  options: EraseCompanyOptions,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }
  if (options.confirm !== company.name) {
    throw new Error(
      `Confirmation mismatch: expected "${company.name}", got "${options.confirm}"`,
    );
  }

  // 1. Setup services
  const audit = new AuditService(prisma as any);
  const userStatusCache = new UserStatusCache(prisma as any);
  const dummyQueue: any = { add: async () => {} };
  const erasureService = new ErasureService(
    prisma as any,
    audit,
    storage,
    dummyQueue,
    userStatusCache,
  );

  // 2. Erase all employees
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { id: true },
  });

  for (const emp of employees) {
    await erasureService.erase(emp.id, companyId);
  }

  // 3. Remove remaining company reports and storage
  const reports = await prisma.report.findMany({
    where: { companyId },
    select: { id: true, storageKey: true },
  });
  for (const r of reports) {
    if (r.storageKey) {
      await storage.remove(r.storageKey).catch(() => undefined);
    }
  }
  const delReports = await prisma.report.deleteMany({ where: { companyId } });

  // 4. Remove remaining company data exports and storage
  const exports = await prisma.dataExport.findMany({
    where: { companyId },
    select: { id: true, storageKey: true },
  });
  for (const exp of exports) {
    if (exp.storageKey) {
      await storage.remove(exp.storageKey).catch(() => undefined);
    }
  }
  const delExports = await prisma.dataExport.deleteMany({ where: { companyId } });

  // 5. Delete summaries, invitations, consent records, deletion requests
  await prisma.generatedSummary.deleteMany({ where: { companyId } });
  await prisma.invitation.deleteMany({ where: { companyId } });
  await prisma.consentRecord.deleteMany({ where: { companyId } });
  await prisma.deletionRequest.deleteMany({ where: { companyId } });

  // 6. Delete users and tokens (unlink employee.userId first to avoid FK constraint)
  await prisma.employee.updateMany({
    where: { companyId },
    data: { userId: null },
  });

  const users = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // 7. Update company row
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: 'Deleted company',
      preciseLocationRetentionDays: 30,
    },
  });

  // 8. Record company.erased in audit log
  await audit.record({
    companyId,
    action: 'company.erased',
    entityType: 'company',
    entityId: companyId,
    metadata: {
      completed: true,
      employeesErased: employees.length,
      usersDeleted: userIds.length,
      reportsDeleted: delReports.count,
      exportsDeleted: delExports.count,
    },
  });

  return {
    employeesErased: employees.length,
    usersDeleted: userIds.length,
    reportsDeleted: delReports.count,
    exportsDeleted: delExports.count,
  };
}

// CLI runner
async function main() {
  const args = process.argv.slice(2);
  let companyId: string | undefined;
  let confirmName: string | undefined;
  let autoYes = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company') {
      companyId = args[++i];
    } else if (args[i] === '--confirm') {
      confirmName = args[++i];
    } else if (args[i] === '--yes' || args[i] === '-y') {
      autoYes = true;
    }
  }

  if (!companyId || !confirmName) {
    console.error('Usage: ops:erase-company --company <companyId> --confirm "<exact company name>" [--yes]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const storageDir = process.env.REPORT_STORAGE_DIR || './storage/reports';
  const storage = new LocalStorage(storageDir);

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { employees: true, users: true, sessions: true },
        },
      },
    });

    if (!company) {
      console.error(`Error: Company "${companyId}" not found.`);
      process.exit(1);
    }

    if (company.name !== confirmName) {
      console.error(`Error: Confirmation name mismatch. Expected: "${company.name}", Got: "${confirmName}"`);
      process.exit(1);
    }

    console.log(`\n======================================================`);
    console.log(`WARNING: COMPANY ERASURE IS PERMANENT AND IRREVERSIBLE`);
    console.log(`======================================================`);
    console.log(`Company ID:   ${company.id}`);
    console.log(`Company Name: ${company.name}`);
    console.log(`Employees:    ${company._count.employees}`);
    console.log(`Users:        ${company._count.users}`);
    console.log(`Sessions:     ${company._count.sessions}`);
    console.log(`======================================================\n`);

    if (!autoYes) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Type ERASE to permanently delete this company: ', (ans) => {
          rl.close();
          resolve(ans.trim());
        });
      });

      if (answer !== 'ERASE') {
        console.log('Erasure cancelled.');
        process.exit(0);
      }
    }

    console.log('Erasing company and purging all personal data...');
    const result = await eraseCompany(prisma, storage, companyId, { confirm: confirmName });
    console.log('Company erased successfully:', result);
  } catch (err) {
    console.error('Erasure failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('erase-company')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
