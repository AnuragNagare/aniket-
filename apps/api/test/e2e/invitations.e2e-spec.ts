import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';
import { lastMailTo, outbox } from '../helpers/mail.js';

const prisma = new PrismaClient();
const ravi = {
  name: 'Ravi Kumar',
  email: 'ravi@example.com',
  phone: '98765 43210',
  designation: 'Field Technician',
  employeeCode: 'FT-101',
};

afterAll(() => prisma.$disconnect());

describe('invitations (admin)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const invite = (token: string, body: object = ravi) =>
    http().post('/api/v1/employees/invitations').set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    outbox(app).sent.length = 0;
  });
  afterAll(() => app.close());

  it('creates the employee, a hashed 7-day invite, an email and an audit entry', async () => {
    const a = await signupAs(app);
    const res = await invite(a.token).expect(201);

    expect(res.body.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[\w-]{43}$/);
    expect(res.body.emailSent).toBe(true);
    const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: res.body.employeeId } });
    expect(employee).toMatchObject({
      companyId: a.user.companyId,
      email: 'ravi@example.com',
      phone: '+919876543210',
      userId: null,
    });

    const token = res.body.inviteUrl.split('/invite/')[1];
    const stored = await prisma.invitation.findFirstOrThrow({ where: { employeeId: employee.id } });
    expect(stored.tokenHash).not.toBe(token); // only the hash is stored

    expect(lastMailTo(app, 'ravi@example.com')?.text).toContain(res.body.inviteUrl);
    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'invitation.created', actorUserId: a.user.id },
    });
    expect(auditRow.ip).toBeDefined();
    expect(auditRow.userAgent).toBeDefined();

    const list = await http().get('/api/v1/employees').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(list.body.items[0]).toMatchObject({
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      account: 'INVITED',
      status: 'OFF_DUTY',
    });
  });

  it('refuses an email that already has a Work Trail account, before creating anything', async () => {
    const a = await signupAs(app);
    const res = await invite(a.token, { ...ravi, email: a.user.email }).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.employee.count()).toBe(0);
  });

  it('refuses inviting the same person twice', async () => {
    const a = await signupAs(app);
    await invite(a.token).expect(201);
    const res = await invite(a.token, { ...ravi, employeeCode: 'FT-102' }).expect(409);
    expect(res.body.error.code).toBe('ALREADY_INVITED');
  });

  it('refuses a duplicate employee ID within the company', async () => {
    const a = await signupAs(app);
    await invite(a.token).expect(201);
    const res = await invite(a.token, { ...ravi, email: 'other@example.com' }).expect(409);
    expect(res.body.error.code).toBe('EMPLOYEE_CODE_TAKEN');
  });

  it('validates the body with field messages', async () => {
    const a = await signupAs(app);
    const res = await invite(a.token, { name: 'R', email: 'nope' }).expect(400);
    expect(res.body.error.details.fields).toMatchObject({ email: 'Enter a valid email address.' });
  });

  it('resend revokes the old link and issues a new one', async () => {
    const a = await signupAs(app);
    const first = await invite(a.token).expect(201);
    const second = await http()
      .post(`/api/v1/employees/${first.body.employeeId}/invitations`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(201);
    expect(second.body.inviteUrl).not.toBe(first.body.inviteUrl);
    const rows = await prisma.invitation.findMany({
      where: { employeeId: first.body.employeeId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.revokedAt).not.toBeNull();
    expect(rows[1]!.revokedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'invitation.resent' } })).toBe(1);
  });

  it("resend returns 404 for another company's employee", async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    const theirs = await makeEmployee(prisma, b.user.companyId, { email: 'x@b.in' });
    await http()
      .post(`/api/v1/employees/${theirs.id}/invitations`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(404);
  });
});

describe('invitations (employee accepts)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function invited() {
    const a = await signupAs(app);
    const res = await http()
      .post('/api/v1/employees/invitations')
      .set('Authorization', `Bearer ${a.token}`)
      .send(ravi)
      .expect(201);
    const token = (res.body.inviteUrl as string).split('/invite/')[1]!;
    return { admin: a, token, employeeId: res.body.employeeId as string };
  }
  const accept = (token: string, body: object = { name: 'Ravi K', password: 'StrongPass1' }) =>
    http().post(`/api/v1/employees/invitations/${token}/accept`).send(body);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  it('preview shows who invited whom, without signing in', async () => {
    const { admin, token } = await invited();
    const res = await http().get(`/api/v1/employees/invitations/${token}`).expect(200);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: admin.user.companyId } });
    expect(res.body).toMatchObject({
      companyName: company.name,
      employeeName: 'Ravi Kumar',
      email: 'ravi@example.com',
    });
  });

  it('an unknown token is 410 with a plain message', async () => {
    const res = await http().get(`/api/v1/employees/invitations/${'x'.repeat(43)}`).expect(410);
    expect(res.body.error).toMatchObject({
      code: 'INVITE_INVALID',
      message: 'This invite link has expired or was already used. Ask your admin for a new one.',
    });
  });

  it('accept creates an EMPLOYEE account linked to the employee and signs them in', async () => {
    const { admin, token, employeeId } = await invited();
    const res = await accept(token).expect(200);
    expect(res.body.user).toMatchObject({
      role: 'EMPLOYEE',
      email: 'ravi@example.com',
      name: 'Ravi K',
      companyId: admin.user.companyId,
    });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    expect(employee.userId).toBe(res.body.user.id);
    expect(employee.name).toBe('Ravi K');
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ravi@example.com', password: 'StrongPass1' })
      .expect(200);
    expect(
      await prisma.auditLog.count({ where: { action: 'invitation.accepted', actorUserId: res.body.user.id } }),
    ).toBe(1);
    const list = await http().get('/api/v1/employees').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body.items[0].account).toBe('ACTIVE');
  });

  it('a link works once, even when opened twice at the same moment', async () => {
    const { token } = await invited();
    const [a, b] = await Promise.all([accept(token), accept(token)]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 410]);
    expect(await prisma.user.count({ where: { role: 'EMPLOYEE' } })).toBe(1);
    await accept(token).expect(410);
  });

  it('an expired link is refused', async () => {
    const { token } = await invited();
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await accept(token).expect(410);
  });

  it('a revoked link (after resend) is refused and the new one works', async () => {
    const { admin, token, employeeId } = await invited();
    const again = await http()
      .post(`/api/v1/employees/${employeeId}/invitations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    await accept(token).expect(410);
    await accept((again.body.inviteUrl as string).split('/invite/')[1]!).expect(200);
  });

  it('a weak password is a 400 and leaves the link usable', async () => {
    const { token } = await invited();
    await accept(token, { name: 'Ravi', password: 'short' }).expect(400);
    await accept(token).expect(200);
  });

  it('an EMPLOYEE cannot invite others', async () => {
    const { token } = await invited();
    const { body } = await accept(token).expect(200);
    await http()
      .post('/api/v1/employees/invitations')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ ...ravi, email: 'new@example.com', employeeCode: 'FT-9' })
      .expect(403);
  });
});
