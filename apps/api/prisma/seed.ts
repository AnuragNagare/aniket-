// Demo data: one company, one owner and five field employees around Mumbai, each with a
// completed session yesterday and a session today (four still active), location points
// every five minutes and one work update per session. Safe to re-run.
import { type Prisma, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();

const TZ = 'Asia/Kolkata';
const COMPANY_NAME = 'Demo Field Services Pvt Ltd';
const ADMIN_EMAIL = 'admin@demo.worktrail.in';
const POINT_INTERVAL_MS = 5 * 60_000;

type Stop = [lat: number, lng: number];

const EMPLOYEES: Array<{ name: string; designation: string; route: Stop[] }> = [
  {
    name: 'Amit Kumar',
    designation: 'Field Sales Executive',
    route: [[19.0176, 72.8562], [19.033, 72.857], [19.0544, 72.8406], [19.0596, 72.8295]],
  },
  {
    name: 'Neha Patel',
    designation: 'Service Technician',
    route: [[19.1136, 72.8697], [19.1197, 72.8468], [19.1075, 72.8263], [19.099, 72.826]],
  },
  {
    name: 'Rohit Singh',
    designation: 'Site Supervisor',
    route: [[18.922, 72.8347], [18.9322, 72.8264], [18.9398, 72.8355], [18.955, 72.812]],
  },
  {
    name: 'Pooja Verma',
    designation: 'Merchandiser',
    route: [[19.2183, 72.9781], [19.1972, 72.9707], [19.186, 72.975], [19.1726, 72.9563]],
  },
  {
    name: 'Vikram Rao',
    designation: 'Field Sales Executive',
    route: [[19.033, 73.0297], [19.045, 73.026], [19.076, 72.998], [19.064, 72.999]],
  },
];

const UPDATES = [
  'Met purchase manager at ABC Traders. Discussed next quarter order of 40 units. Follow-up call on Friday.',
  'Completed installation at Sai Kripa Clinic. One sensor needs replacement, raised request with store.',
  'Site visit at Andheri warehouse done. Photos shared with client. Awaiting confirmation on layout.',
  'Follow-up call with Mehta Hardware done. They want a revised quote with delivery included.',
  'Stock audit at Thane outlet completed. Display shelf damaged, reported to area manager.',
];

/** Evenly spaced points along a multi-stop route. */
function interpolate(route: Stop[], steps: number): Stop[] {
  const out: Stop[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / Math.max(steps - 1, 1)) * (route.length - 1);
    const a = route[Math.floor(t)]!;
    const b = route[Math.min(Math.ceil(t), route.length - 1)]!;
    const f = t - Math.floor(t);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

async function seedSession(opts: {
  companyId: string;
  employeeId: string;
  route: Stop[];
  day: Date;
  startHour: number;
  minutes: number;
  active: boolean;
  updateText: string;
}) {
  const now = new Date();
  const dayStr = formatInTimeZone(opts.day, TZ, 'yyyy-MM-dd');
  const start = fromZonedTime(`${dayStr}T${String(opts.startHour).padStart(2, '0')}:00:00`, TZ);
  if (start > now) return; // early-morning seed: today's shift hasn't started yet

  const plannedEnd = new Date(start.getTime() + opts.minutes * 60_000);
  const active = opts.active && plannedEnd > now;
  const end = active ? now : plannedEnd < now ? plannedEnd : now;

  const session = await prisma.workSession.create({
    data: {
      companyId: opts.companyId,
      employeeId: opts.employeeId,
      status: active ? 'ACTIVE' : 'COMPLETED',
      startedAtServer: start,
      startedAtDevice: start,
      endedAtServer: active ? null : end,
      endedAtDevice: active ? null : end,
      totalMinutes: active ? null : Math.round((end.getTime() - start.getTime()) / 60_000),
    },
  });

  const count = Math.max(2, Math.floor((end.getTime() - start.getTime()) / POINT_INTERVAL_MS) + 1);
  const points: Prisma.LocationPointCreateManyInput[] = interpolate(opts.route, count).map(
    ([lat, lng], i) => ({
      companyId: opts.companyId,
      employeeId: opts.employeeId,
      sessionId: session.id,
      clientPointId: randomUUID(),
      latitude: lat,
      longitude: lng,
      accuracyMeters: 12 + (i % 5) * 4,
      source: i === 0 ? 'START' : !active && i === count - 1 ? 'END' : 'BACKGROUND',
      capturedAt: new Date(start.getTime() + i * POINT_INTERVAL_MS),
    }),
  );
  await prisma.locationPoint.createMany({ data: points });

  await prisma.workUpdate.create({
    data: {
      companyId: opts.companyId,
      employeeId: opts.employeeId,
      sessionId: session.id,
      text: opts.updateText,
      inputMethod: 'VOICE',
      submittedAt: new Date(Math.min(start.getTime() + 95 * 60_000, end.getTime())),
    },
  });
}

/** Removes a previous demo company and everything that belongs to it. */
async function removeExistingDemo() {
  const existing = await prisma.company.findMany({ where: { name: COMPANY_NAME } });
  for (const { id: companyId } of existing) {
    await prisma.$transaction([
      prisma.locationPoint.deleteMany({ where: { companyId } }),
      prisma.workUpdate.deleteMany({ where: { companyId } }),
      prisma.workSession.deleteMany({ where: { companyId } }),
      prisma.generatedSummary.deleteMany({ where: { companyId } }),
      prisma.report.deleteMany({ where: { companyId } }),
      prisma.invitation.deleteMany({ where: { companyId } }),
      prisma.auditLog.deleteMany({ where: { companyId } }),
      prisma.employee.deleteMany({ where: { companyId } }),
      prisma.user.deleteMany({ where: { companyId } }),
      prisma.company.delete({ where: { id: companyId } }),
    ]);
  }
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error('Set SEED_ADMIN_PASSWORD in .env before seeding.');

  await removeExistingDemo();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const company = await prisma.company.create({ data: { name: COMPANY_NAME } });
  await prisma.user.create({
    data: {
      companyId: company.id,
      role: 'OWNER',
      name: 'Rahul Sharma',
      email: ADMIN_EMAIL,
      phone: '+919800000001',
      passwordHash,
    },
  });

  const today = new Date();
  for (const [i, e] of EMPLOYEES.entries()) {
    // Every demo employee has already accepted their invite, so they can sign in on the app.
    const email = `${e.name.split(' ')[0]!.toLowerCase()}@demo.worktrail.in`;
    const phone = `+9198000001${10 + i}`;
    const user = await prisma.user.create({
      data: { companyId: company.id, role: 'EMPLOYEE', name: e.name, email, phone, passwordHash },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        userId: user.id,
        name: e.name,
        email,
        designation: e.designation,
        employeeCode: `FT-${101 + i}`,
        phone,
      },
    });
    const common = { companyId: company.id, employeeId: employee.id, route: e.route, startHour: 9 };
    await seedSession({
      ...common,
      day: subDays(today, 1),
      minutes: 420 + i * 15,
      active: false,
      updateText: UPDATES[(i + 1) % UPDATES.length]!,
    });
    await seedSession({
      ...common,
      day: today,
      minutes: 600 + i * 10,
      active: i < 4,
      updateText: UPDATES[i]!,
    });
  }

  console.log(
    `Seeded "${COMPANY_NAME}". Admin: ${ADMIN_EMAIL}; employees: amit@, neha@, rohit@, pooja@, vikram@demo.worktrail.in. All use SEED_ADMIN_PASSWORD.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
