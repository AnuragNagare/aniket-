import { PrismaClient } from '@prisma/client';
import { makeCompany, makeEmployee, resetDb } from '../helpers/db.js';

const prisma = new PrismaClient();

describe('schema rules', () => {
  beforeEach(() => resetDb(prisma));
  afterAll(() => prisma.$disconnect());

  it('allows only one ACTIVE session per employee', async () => {
    const c = await makeCompany(prisma);
    const e = await makeEmployee(prisma, c.id);
    const base = { companyId: c.id, employeeId: e.id, startedAtServer: new Date() };
    await prisma.workSession.create({ data: base });
    await expect(prisma.workSession.create({ data: base })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows a new ACTIVE session after the previous one completes', async () => {
    const c = await makeCompany(prisma);
    const e = await makeEmployee(prisma, c.id);
    const base = { companyId: c.id, employeeId: e.id, startedAtServer: new Date() };
    await prisma.workSession.create({ data: { ...base, status: 'COMPLETED' } });
    await expect(prisma.workSession.create({ data: base })).resolves.toBeTruthy();
  });

  it('dedupes location points by (employee, clientPointId)', async () => {
    const c = await makeCompany(prisma);
    const e = await makeEmployee(prisma, c.id);
    const s = await prisma.workSession.create({
      data: { companyId: c.id, employeeId: e.id, startedAtServer: new Date() },
    });
    const point = {
      companyId: c.id,
      employeeId: e.id,
      sessionId: s.id,
      clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
      latitude: 19.076,
      longitude: 72.8777,
      source: 'START' as const,
      capturedAt: new Date(),
    };
    await prisma.locationPoint.create({ data: point });
    await expect(prisma.locationPoint.create({ data: point })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
