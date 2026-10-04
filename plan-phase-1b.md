# Work Trail Phase 1b: Invitations and Account Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins invite employees with a single-use link (copy, WhatsApp or email). Employees accept and set a password. Anyone can reset a forgotten password. The admin web app gains a working Employees page.

**Architecture:** Builds on Phase 0–1 (branch `work-trail/phase-0-1`). The API gets a new `invitations` module and a password-reset service inside `auth`. Both follow the existing MVC layout (`modules/<feature>/{controllers,services}`). They share two small global services: `AuditService`, which writes `audit_logs`, and `Mailer`. In dev and test, `Mailer` is an in-memory outbox that logs to the console; a real provider is added when keys are supplied. The web app adds Server Actions for authenticated changes (invite, resend), public pages for forgot/reset/accept, and the Employees list page. Every request still goes through the httpOnly-cookie session from Phase 0–1.

**Tech Stack:** Same as Phase 0–1: NestJS 12 + Prisma 6 + PostgreSQL, Next.js 16 (App Router, `proxy.ts`, Server Actions), Zod 4, Vitest + Testing Library + supertest.

**Spec:** `docs/specs/prd.pdf` §3 "Admin onboarding" and §4 "Authentication and invitations". Also `docs/specs/api-contract.pdf` "Employees" (`POST /employees/invitations`, `POST /employees/invitations/:token/accept`, `GET /employees`), `docs/specs/data-model.pdf` (`invitations`, `audit_logs`), and the master plan `plan.md` (Design System, Global Constraints, Phase 1b outline).

## Global Constraints

- Everything in `plan.md` → Global Constraints still applies. That includes company scoping (another company's id returns 404), the error envelope `{ error: { code, message, details } }`, `/api/v1`, argon2id and no secrets in the repo.
- "Invitation has a single-use, expiring token and is tied to an organisation and intended employee" (PRD §4). Invite links last **7 days** and only a SHA-256 hash of the token is stored (data-model: "store hash, never plaintext token").
- "Support forgot-password flow" (PRD §4). Reset links last **1 hour** and are single-use. A successful reset ends every signed-in session for that user.
- Forgot-password responds the same way whether or not the email exists. It must never reveal which emails have accounts.
- Audit at minimum "invitation creation/acceptance" (data-model `audit_logs`). Also audit resends and password resets.
- Employees sign in with email + password until mobile OTP arrives after the MVP, so **an invite requires an email**. Phone is optional.
- The admin web app is for OWNER/ADMIN only. An EMPLOYEE who tries to sign in on the web is told to use the Work Trail app.
- New API code follows the existing layout: `src/modules/<feature>/{<feature>.module.ts,controllers/,services/}`, plus shared infrastructure in `src/common/`. Relative imports end in `.js` (ESM).
- New web code follows `src/components/<area>/` + `src/lib/`. The UI uses the tokens and primitives from `@worktrail/ui` and `src/components/ui/` (Button, Field, Input, Card, SegmentedTabs).
- Copy is plain and in sentence case. Errors say what happened and what to do next, without apologising.

## Review Focus

1. **Invite link opened twice, or by two people at once.** Exactly one account is created; the second attempt gets "This invite link has expired or was already used." Test in Task 4 (sequential and concurrent accepts).
2. **Admin re-sends an invite.** The old link stops working immediately and the new one works. Test in Task 3.
3. **Inviting an email that already has a Work Trail account** (in this or any company). The admin gets a clear 409 before any employee row is created. Test in Task 3.
4. **Password reset requested for an unknown email.** Same response, same body, no email sent. Test in Task 5.
5. **An employee accepts an invite and then tries the admin web login.** They're told to use the app, and no web session cookies are set. Test in Task 8.

---

## File Structure

```
apps/api/
  prisma/schema.prisma                                   + Invitation.revokedAt, + PasswordResetToken
  prisma/migrations/<ts>_invitation_revoked_at/          (Task 3)
  prisma/migrations/<ts>_password_reset_tokens/          (Task 5)
  src/common/audit/audit.module.ts                       global AuditService
  src/common/audit/audit.service.ts
  src/common/mail/mail.module.ts                         global Mailer → OutboxMailer
  src/common/mail/mailer.ts                              Mailer (abstract DI token) + MailMessage
  src/common/mail/outbox.mailer.ts                       dev/test mailer: logs + keeps last 50
  src/common/utils/secure-token.ts                       newToken(), sha256()
  src/modules/invitations/invitations.module.ts
  src/modules/invitations/controllers/invitations.controller.ts         admin: create, resend
  src/modules/invitations/controllers/accept-invitation.controller.ts   public: preview, accept
  src/modules/invitations/services/invitations.service.ts
  src/modules/auth/services/password-reset.service.ts
  src/modules/auth/controllers/auth.controller.ts        + forgot-password, reset-password
  src/modules/employees/services/employees.service.ts    + email, account
  test/e2e/invitations.e2e-spec.ts
  test/e2e/password-reset.e2e-spec.ts
  test/helpers/mail.ts                                   outbox(app), lastMailTo(app, email)
packages/types/src/
  auth.ts                                                + export EmailSchema
  employees.ts                                           list types + InviteEmployeeSchema
  invitations.ts                                         InvitationCreated, InvitationPreview, AcceptInvitationSchema
  password.ts                                            ForgotPasswordSchema, ResetPasswordSchema
apps/web/src/
  lib/server-api.ts                                      + serverMutate()
  lib/public-api.ts                                      publicGet() for unauthenticated reads
  lib/employees-query.ts                                 parse/serialise list filters
  app/app/employees/page.tsx                             list
  app/app/employees/new/page.tsx                         invite
  app/app/employees/actions.ts                           'use server' inviteEmployee, resendInvite
  app/api/session/[action]/route.ts                      + forgot-password, reset-password, accept-invite; block EMPLOYEE
  app/(auth)/forgot-password/page.tsx
  app/(auth)/reset-password/page.tsx
  app/(auth)/invite/[token]/page.tsx
  components/employees/{status-chip,employees-toolbar,employee-table,pagination,invite-form,invite-link-panel,resend-invite-button}.tsx
  components/auth/{forgot-password-form,reset-password-form,accept-invite-form}.tsx
  test/{employees-query,employees,invite,public-auth-forms}.test.tsx
```

---

### Task 1: Shared types for invitations, employees and password reset

**Files:**
- Modify: `packages/types/src/auth.ts` (export `EmailSchema`), `packages/types/src/index.ts`
- Create: `packages/types/src/employees.ts`, `packages/types/src/invitations.ts`, `packages/types/src/password.ts`
- Test: `packages/types/test/invitations.test.ts`

**Interfaces:**
- Produces:
  - `EmailSchema`
  - `EmployeeStatus = 'WORKING' | 'OFF_DUTY'`
  - `EmployeeAccount = 'INVITED' | 'ACTIVE'`
  - `EmployeeListItem { id; name; designation: string|null; employeeCode: string|null; email: string|null; status: EmployeeStatus; account: EmployeeAccount }`
  - `EmployeeListResponse { items: EmployeeListItem[]; page; pageSize; total }`
  - `InviteEmployeeSchema` with output type `InviteEmployeeInput { name; email; phone?: string /* +91… */; designation?: string; employeeCode?: string }`
  - `InvitationCreated { employeeId; inviteUrl; expiresAt: string; emailSent: boolean }`
  - `InvitationPreview { companyName; employeeName; email; expiresAt: string }`
  - `AcceptInvitationSchema` → `AcceptInvitationInput { name; password }`
  - `ForgotPasswordSchema` → `{ email }`
  - `ResetPasswordSchema` → `ResetPasswordInput { token; password }`

- [ ] **Step 1: Write the failing test.** Create `packages/types/test/invitations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AcceptInvitationSchema,
  ForgotPasswordSchema,
  InviteEmployeeSchema,
  ResetPasswordSchema,
} from '../src/index.js';

describe('InviteEmployeeSchema', () => {
  it('normalises email and phone, drops blank optional fields', () => {
    const out = InviteEmployeeSchema.parse({
      name: ' Ravi Kumar ',
      email: ' Ravi@Example.com ',
      phone: '98765 43210',
      designation: '  ',
      employeeCode: '',
    });
    expect(out).toEqual({ name: 'Ravi Kumar', email: 'ravi@example.com', phone: '+919876543210' });
  });

  it('accepts a missing or empty phone', () => {
    expect(InviteEmployeeSchema.parse({ name: 'Ravi', email: 'r@x.in', phone: '' }).phone).toBeUndefined();
    expect(InviteEmployeeSchema.parse({ name: 'Ravi', email: 'r@x.in' }).phone).toBeUndefined();
  });

  it('requires an email because employees sign in with it', () => {
    const r = InviteEmployeeSchema.safeParse({ name: 'Ravi', email: '' });
    expect(r.error?.issues[0]?.message).toBe('Enter a valid email address.');
  });
});

describe('accept and reset', () => {
  it('AcceptInvitationSchema applies the password rule', () => {
    const r = AcceptInvitationSchema.safeParse({ name: 'Ravi Kumar', password: 'short' });
    expect(r.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });

  it('ForgotPasswordSchema normalises the email', () => {
    expect(ForgotPasswordSchema.parse({ email: ' A@B.IN ' }).email).toBe('a@b.in');
  });

  it('ResetPasswordSchema needs a token and a valid password', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'x', password: 'StrongPass1' }).success).toBe(false);
    expect(
      ResetPasswordSchema.safeParse({ token: 'a'.repeat(43), password: 'StrongPass1' }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
Run: `pnpm --filter @worktrail/types test`
Expected: FAIL (`InviteEmployeeSchema` is not exported).

- [ ] **Step 3: Implement.**

In `packages/types/src/auth.ts`, replace `const Email = …` with an exported schema and use it in both places:

```ts
export const EmailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');
```
(Then change `email: Email` to `email: EmailSchema` in `AdminSignupSchema` and `LoginSchema`.)

`packages/types/src/employees.ts`:
```ts
import { z } from 'zod';
import { EmailSchema } from './auth.js';
import { IndianMobileSchema } from './phone.js';

export type EmployeeStatus = 'WORKING' | 'OFF_DUTY';
/** INVITED = invite sent, no account yet. ACTIVE = the employee has set a password. */
export type EmployeeAccount = 'INVITED' | 'ACTIVE';

export type EmployeeListItem = {
  id: string;
  name: string;
  designation: string | null;
  employeeCode: string | null;
  email: string | null;
  status: EmployeeStatus;
  account: EmployeeAccount;
};

export type EmployeeListResponse = {
  items: EmployeeListItem[];
  page: number;
  pageSize: number;
  total: number;
};

/** Optional free text: trimmed, and blank becomes undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const InviteEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee's name.").max(160),
  email: EmailSchema,
  phone: z
    .union([z.literal(''), IndianMobileSchema])
    .optional()
    .transform((v) => (v ? v : undefined)),
  designation: optionalText(120),
  employeeCode: optionalText(80),
});
export type InviteEmployeeInput = z.output<typeof InviteEmployeeSchema>;
```

`packages/types/src/invitations.ts`:
```ts
import { z } from 'zod';
import { PasswordSchema } from './auth.js';

export type InvitationCreated = {
  employeeId: string;
  inviteUrl: string;
  expiresAt: string;
  emailSent: boolean;
};

export type InvitationPreview = {
  companyName: string;
  employeeName: string;
  email: string;
  expiresAt: string;
};

export const AcceptInvitationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(160),
  password: PasswordSchema,
});
export type AcceptInvitationInput = z.output<typeof AcceptInvitationSchema>;
```

`packages/types/src/password.ts`:
```ts
import { z } from 'zod';
import { EmailSchema, PasswordSchema } from './auth.js';

export const ForgotPasswordSchema = z.object({ email: EmailSchema });
export type ForgotPasswordInput = z.output<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(20, 'This reset link is incomplete. Open the link from your email again.'),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.output<typeof ResetPasswordSchema>;
```

Append to `packages/types/src/index.ts`:
```ts
export * from './employees.js';
export * from './invitations.js';
export * from './password.js';
```

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build`
Expected: PASS (21 tests). `dist/` rebuilt.

- [ ] **Step 5: Commit.**
```bash
git add packages/types
git commit -m "feat(types): invitation, employee list and password reset schemas"
```

---

### Task 2: Audit and mail infrastructure (API)

**Files:**
- Create: `apps/api/src/common/audit/audit.service.ts`, `apps/api/src/common/audit/audit.module.ts`, `apps/api/src/common/mail/mailer.ts`, `apps/api/src/common/mail/outbox.mailer.ts`, `apps/api/src/common/mail/mail.module.ts`, `apps/api/src/common/utils/secure-token.ts`, `apps/api/test/helpers/mail.ts`
- Modify: `apps/api/src/app.module.ts` (import `AuditModule`, `MailModule`)
- Test: `apps/api/test/unit/secure-token.spec.ts`, `apps/api/test/unit/outbox-mailer.spec.ts`

**Interfaces:**
- Produces:
  - `AuditService.record(entry: AuditEntry, db?: PrismaService | Prisma.TransactionClient): Promise<void>`
  - `AuditAction = 'invitation.created' | 'invitation.resent' | 'invitation.accepted' | 'password.reset'`
  - `abstract class Mailer { send(message: MailMessage): Promise<void> }`
  - `MailMessage { to; subject; text }`
  - `OutboxMailer extends Mailer` with `readonly sent: MailMessage[]`
  - `newToken(): string` (43-char base64url)
  - `sha256(value: string): string`
  - Test helpers: `outbox(app): OutboxMailer` and `lastMailTo(app, email): MailMessage | undefined`

- [ ] **Step 1: Write the failing tests.**

`apps/api/test/unit/secure-token.spec.ts`:
```ts
import { newToken, sha256 } from '../../src/common/utils/secure-token.js';

describe('secure tokens', () => {
  it('makes 256-bit url-safe tokens that never repeat', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hashes deterministically to hex', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
```

`apps/api/test/unit/outbox-mailer.spec.ts`:
```ts
import { OutboxMailer } from '../../src/common/mail/outbox.mailer.js';

describe('OutboxMailer', () => {
  it('keeps sent messages, newest last, capped at 50', async () => {
    const mailer = new OutboxMailer();
    for (let i = 0; i < 52; i++) await mailer.send({ to: `u${i}@x.in`, subject: 's', text: 't' });
    expect(mailer.sent).toHaveLength(50);
    expect(mailer.sent.at(-1)?.to).toBe('u51@x.in');
    expect(mailer.sent[0]?.to).toBe('u2@x.in');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.**
Run: `pnpm --filter @worktrail/api test:unit`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement.**

`src/common/utils/secure-token.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of randomness, URL-safe. Used for invite and password-reset links. */
export const newToken = () => randomBytes(32).toString('base64url');

/** Tokens are stored only as this hash, so a database leak can't be replayed as links. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
```

`src/common/mail/mailer.ts`:
```ts
export type MailMessage = { to: string; subject: string; text: string };

/** Sends transactional email. Abstract class so it doubles as the Nest DI token. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
```

`src/common/mail/outbox.mailer.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { Mailer, type MailMessage } from './mailer.js';

const KEEP = 50;

/**
 * Dev/test mailer: prints each email to the API log and keeps the last 50 in memory
 * (tests read them). Swapped for a real provider once mail credentials exist.
 */
@Injectable()
export class OutboxMailer extends Mailer {
  private readonly logger = new Logger('Mail');
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > KEEP) this.sent.shift();
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
  }
}
```

`src/common/mail/mail.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { OutboxMailer } from './outbox.mailer.js';

@Global()
@Module({ providers: [{ provide: Mailer, useClass: OutboxMailer }], exports: [Mailer] })
export class MailModule {}
```

`src/common/audit/audit.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export type AuditAction =
  | 'invitation.created'
  | 'invitation.resent'
  | 'invitation.accepted'
  | 'password.reset';

export type AuditEntry = {
  companyId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: 'invitation' | 'user';
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type Db = PrismaService | Prisma.TransactionClient;

/** Append-only record of sensitive actions (data-model.pdf → audit_logs). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction client so the audit row commits or rolls back with the change. */
  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
      },
    });
  }
}
```

`src/common/audit/audit.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
```

`test/helpers/mail.ts`:
```ts
import type { INestApplication } from '@nestjs/common';
import { Mailer, type MailMessage } from '../../src/common/mail/mailer.js';
import type { OutboxMailer } from '../../src/common/mail/outbox.mailer.js';

export const outbox = (app: INestApplication) => app.get(Mailer) as OutboxMailer;

export const lastMailTo = (app: INestApplication, email: string): MailMessage | undefined =>
  outbox(app).sent.filter((m) => m.to === email).at(-1);

/** Pulls the first http(s) link out of an email body. */
export const linkIn = (mail: MailMessage | undefined) => mail?.text.match(/https?:\/\/\S+/)?.[0];
```

In `src/app.module.ts`, add `import { AuditModule } from './common/audit/audit.module.js';` and `import { MailModule } from './common/mail/mail.module.js';`, and put both in `imports` right after `DatabaseModule`.

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/api test`
Expected: PASS (unit 17, e2e 25). Existing suites stay green.

- [ ] **Step 5: Commit.**
```bash
git add apps/api
git commit -m "feat(api): global audit log and dev outbox mailer"
```

---

### Task 3: Create and re-send invitations (API)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add `revokedAt` to `Invitation`)
- Create: migration `invitation_revoked_at`, `apps/api/src/modules/invitations/invitations.module.ts`, `apps/api/src/modules/invitations/controllers/invitations.controller.ts`, `apps/api/src/modules/invitations/services/invitations.service.ts`
- Modify: `apps/api/src/modules/employees/services/employees.service.ts` (`email`, `account`; types from `@worktrail/types`), `apps/api/src/modules/employees/controllers/employees.controller.ts` (import `EmployeeStatus` from `@worktrail/types`), `apps/api/src/modules/auth/auth.module.ts` (export `TokensService`), `apps/api/src/app.module.ts`
- Test: `apps/api/test/e2e/invitations.e2e-spec.ts`

**Interfaces:**
- Consumes:
  - `InviteEmployeeSchema`, `InviteEmployeeInput`, `InvitationCreated`, `EmployeeListItem` (Task 1)
  - `AuditService`, `Mailer`, `newToken`, `sha256` (Task 2)
  - `AuthContext`, `@Roles`, `@CurrentAuth`, `AppError`, `ZodBody`, `ENV` (Phase 0–1)
- Produces:
  - `POST /api/v1/employees/invitations`: 201 `InvitationCreated`. 409 `EMAIL_TAKEN`, `ALREADY_INVITED` or `EMPLOYEE_CODE_TAKEN`.
  - `POST /api/v1/employees/:employeeId/invitations` (resend): 201 `InvitationCreated`. 404 for another company or a bad id. 409 `ALREADY_JOINED`.
  - `InvitationsService.preview` and `.accept`, filled in by Task 4. This task creates the class with `invite` and `resend`.
  - `GET /employees` items now include `email` and `account`.
  - Invite URL format: `${WEB_ORIGIN}/invite/<43-char token>`.

- [ ] **Step 1: Schema change and migration.** In `schema.prisma`, add a line to `model Invitation` after `acceptedAt`:

```prisma
  revokedAt       DateTime? @map("revoked_at") @db.Timestamptz
```
Run:
```bash
cd apps/api
node scripts/with-env.mjs prisma migrate dev --name invitation_revoked_at
pnpm db:test:migrate
cd ../..
```
Expected: "Your database is now in sync with your schema" and "All migrations have been successfully applied."

- [ ] **Step 2: Write the failing e2e test.** Create `apps/api/test/e2e/invitations.e2e-spec.ts`:

```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';
import { lastMailTo, outbox } from '../helpers/mail.js';

const prisma = new PrismaClient();
const ravi = { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '98765 43210', designation: 'Field Technician', employeeCode: 'FT-101' };

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
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates the employee, a hashed 7-day invite, an email and an audit entry', async () => {
    const a = await signupAs(app);
    const res = await invite(a.token).expect(201);

    expect(res.body.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[\w-]{43}$/);
    expect(res.body.emailSent).toBe(true);
    const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: res.body.employeeId } });
    expect(employee).toMatchObject({ companyId: a.user.companyId, email: 'ravi@example.com', phone: '+919876543210', userId: null });

    const token = res.body.inviteUrl.split('/invite/')[1];
    const stored = await prisma.invitation.findFirstOrThrow({ where: { employeeId: employee.id } });
    expect(stored.tokenHash).not.toBe(token); // only the hash is stored

    expect(lastMailTo(app, 'ravi@example.com')?.text).toContain(res.body.inviteUrl);
    expect(await prisma.auditLog.count({ where: { action: 'invitation.created', actorUserId: a.user.id } })).toBe(1);

    const list = await http().get('/api/v1/employees').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(list.body.items[0]).toMatchObject({ name: 'Ravi Kumar', email: 'ravi@example.com', account: 'INVITED', status: 'OFF_DUTY' });
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
    const rows = await prisma.invitation.findMany({ where: { employeeId: first.body.employeeId }, orderBy: { createdAt: 'asc' } });
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
```

- [ ] **Step 3: Run it and confirm it fails.**
Run: `cd apps/api && pnpm exec vitest run --config vitest.config.e2e.ts test/e2e/invitations`
Expected: FAIL (404 on `POST /api/v1/employees/invitations`).

- [ ] **Step 4: Implement.**

`src/modules/auth/auth.module.ts`: add `exports: [TokensService],` to the `@Module({...})` object.

`src/modules/employees/services/employees.service.ts`: replace the local `EmployeeStatus`/`EmployeeListItem` types with imports, and extend `select`/`toItem`:
```ts
import type { EmployeeListItem, EmployeeListResponse, EmployeeStatus } from '@worktrail/types';
// …
export type EmployeeListQuery = { query?: string; status?: EmployeeStatus; page: number; pageSize: number };

const select = {
  id: true,
  name: true,
  designation: true,
  employeeCode: true,
  email: true,
  userId: true,
  sessions: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 },
} satisfies Prisma.EmployeeSelect;

const toItem = (r: Row): EmployeeListItem => ({
  id: r.id,
  name: r.name,
  designation: r.designation,
  employeeCode: r.employeeCode,
  email: r.email,
  status: r.sessions.length ? 'WORKING' : 'OFF_DUTY',
  account: r.userId ? 'ACTIVE' : 'INVITED',
});
```
Give `list` the return type `Promise<EmployeeListResponse>`. In `employees.controller.ts`, change the import to `import type { EmployeeStatus } from '@worktrail/types';` and import `EmployeesService` alone from the service file.

`src/modules/invitations/services/invitations.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InvitationCreated, InviteEmployeeInput } from '@worktrail/types';
import { addDays } from 'date-fns';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { Mailer } from '../../../common/mail/mailer.js';
import { newToken, sha256 } from '../../../common/utils/secure-token.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

export const INVITE_TTL_DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin-side invitation lifecycle: create and re-send single-use, expiring invite links. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async invite(auth: AuthContext, input: InviteEmployeeInput): Promise<InvitationCreated> {
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email already has a Work Trail account. Use a different email.');
    }
    const existing = await this.prisma.employee.findFirst({
      where: { companyId: auth.companyId, email: input.email },
    });
    if (existing) {
      throw new AppError(
        409,
        'ALREADY_INVITED',
        'This person is already on your team. Send them a new invite link from the Employees page.',
      );
    }

    const token = newToken();
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            companyId: auth.companyId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            designation: input.designation,
            employeeCode: input.employeeCode,
          },
        });
        const invitation = await tx.invitation.create({
          data: {
            companyId: auth.companyId,
            employeeId: created.id,
            tokenHash: sha256(token),
            expiresAt,
            createdByUserId: auth.userId,
          },
        });
        await this.audit.record(
          { companyId: auth.companyId, actorUserId: auth.userId, action: 'invitation.created', entityType: 'invitation', entityId: invitation.id },
          tx,
        );
        return created;
      });
      return this.deliver(auth.companyId, employee.id, employee.name, input.email, token, expiresAt);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'EMPLOYEE_CODE_TAKEN', 'Another employee already uses this employee ID.');
      }
      throw e;
    }
  }

  async resend(auth: AuthContext, employeeId: string): Promise<InvitationCreated> {
    const employee = UUID.test(employeeId)
      ? await this.prisma.employee.findFirst({ where: { id: employeeId, companyId: auth.companyId } })
      : null;
    if (!employee) throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (employee.userId) {
      throw new AppError(409, 'ALREADY_JOINED', 'This employee has already set up their account.');
    }
    if (!employee.email) {
      throw new AppError(409, 'EMAIL_MISSING', 'Add an email for this employee before sending an invite.');
    }

    const token = newToken();
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { employeeId: employee.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invitation = await tx.invitation.create({
        data: {
          companyId: auth.companyId,
          employeeId: employee.id,
          tokenHash: sha256(token),
          expiresAt,
          createdByUserId: auth.userId,
        },
      });
      await this.audit.record(
        { companyId: auth.companyId, actorUserId: auth.userId, action: 'invitation.resent', entityType: 'invitation', entityId: invitation.id },
        tx,
      );
    });
    return this.deliver(auth.companyId, employee.id, employee.name, employee.email, token, expiresAt);
  }

  /** Builds the link and emails it. Email failure doesn't fail the invite: the admin can still share the link. */
  private async deliver(
    companyId: string,
    employeeId: string,
    name: string,
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<InvitationCreated> {
    const inviteUrl = `${this.env.WEB_ORIGIN}/invite/${token}`;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    let emailSent = true;
    try {
      await this.mailer.send({
        to: email,
        subject: `${company.name} invited you to Work Trail`,
        text: [
          `Hi ${name},`,
          '',
          `${company.name} uses Work Trail to record work sessions and updates.`,
          'Open this link to set your password. It works once and expires in 7 days:',
          inviteUrl,
        ].join('\n'),
      });
    } catch {
      emailSent = false;
    }
    return { employeeId, inviteUrl, expiresAt: expiresAt.toISOString(), emailSent };
  }
}
```

`src/modules/invitations/controllers/invitations.controller.ts`:
```ts
import { Body, Controller, Param, Post } from '@nestjs/common';
import { type InviteEmployeeInput, InviteEmployeeSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { InvitationsService } from '../services/invitations.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('invitations')
  invite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(InviteEmployeeSchema)) body: InviteEmployeeInput,
  ) {
    return this.invitations.invite(auth, body);
  }

  @Post(':employeeId/invitations')
  resend(@CurrentAuth() auth: AuthContext, @Param('employeeId') employeeId: string) {
    return this.invitations.resend(auth, employeeId);
  }
}
```

`src/modules/invitations/invitations.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitationsController } from './controllers/invitations.controller.js';
import { InvitationsService } from './services/invitations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
```
Import `InvitationsModule` in `app.module.ts`, after `EmployeesModule`.

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint`
Expected: PASS (e2e 32). Typecheck and lint clean.

- [ ] **Step 6: Commit.**
```bash
git add apps/api
git commit -m "feat(api): invite employees with hashed single-use links, resend and audit"
```

---

### Task 4: Preview and accept an invitation (API)

**Files:**
- Modify: `apps/api/src/modules/invitations/services/invitations.service.ts` (add `preview`, `accept`), `apps/api/src/modules/invitations/invitations.module.ts`
- Create: `apps/api/src/modules/invitations/controllers/accept-invitation.controller.ts`
- Test: `apps/api/test/e2e/invitations.e2e-spec.ts` (add a second `describe`)

**Interfaces:**
- Consumes: `TokensService.issue(user): Promise<AuthTokens>` (exported in Task 3), `AcceptInvitationSchema`, `InvitationPreview` (Task 1), `hashPassword` (`modules/auth/utils/password.js`).
- Produces:
  - `GET /api/v1/employees/invitations/:token` (public): 200 `InvitationPreview`, or 410 `INVITE_INVALID`.
  - `POST /api/v1/employees/invitations/:token/accept` (public): 200 `AuthTokens` with `user.role === 'EMPLOYEE'`. 410 `INVITE_INVALID`. 409 `EMAIL_TAKEN` (the transaction is rolled back and the invite stays usable).

- [ ] **Step 1: Write the failing tests.** Append to `apps/api/test/e2e/invitations.e2e-spec.ts`:

```ts
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
    expect(res.body).toMatchObject({ companyName: company.name, employeeName: 'Ravi Kumar', email: 'ravi@example.com' });
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
    expect(res.body.user).toMatchObject({ role: 'EMPLOYEE', email: 'ravi@example.com', name: 'Ravi K', companyId: admin.user.companyId });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    expect(employee.userId).toBe(res.body.user.id);
    expect(employee.name).toBe('Ravi K');
    await http().post('/api/v1/auth/login').send({ email: 'ravi@example.com', password: 'StrongPass1' }).expect(200);
    expect(await prisma.auditLog.count({ where: { action: 'invitation.accepted', actorUserId: res.body.user.id } })).toBe(1);
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
```
Also change the first `describe`'s `afterAll` so it doesn't disconnect Prisma (the second block still needs it). Use `afterAll(() => app.close());`, and add at file level: `afterAll(() => prisma.$disconnect());`.

- [ ] **Step 2: Run them and confirm they fail.**
Run: `cd apps/api && pnpm exec vitest run --config vitest.config.e2e.ts test/e2e/invitations`
Expected: the new tests FAIL with 404 (routes missing). The Task 3 tests still pass.

- [ ] **Step 3: Implement.** Add the imports to `invitations.service.ts`:
```ts
import type { AcceptInvitationInput, AuthTokens, InvitationPreview } from '@worktrail/types';
import { TokensService } from '../../auth/services/tokens.service.js';
import { hashPassword } from '../../auth/utils/password.js';
```
Add `private readonly tokens: TokensService,` to the constructor. Then add these methods and helper:

```ts
const inviteInvalid = () =>
  new AppError(410, 'INVITE_INVALID', 'This invite link has expired or was already used. Ask your admin for a new one.');

// inside the class:

  /** Public: what the invite page shows before the employee sets a password. */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { employee: true, company: true },
    });
    if (!invitation || !isUsable(invitation) || !invitation.employee.email) throw inviteInvalid();
    return {
      companyName: invitation.company.name,
      employeeName: invitation.employee.name,
      email: invitation.employee.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /** Public: claims the link (once), creates the EMPLOYEE account and signs them in. */
  async accept(token: string, input: AcceptInvitationInput): Promise<AuthTokens> {
    const tokenHash = sha256(token);
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        // Atomic claim: of two simultaneous accepts, exactly one updates the row.
        const claimed = await tx.invitation.updateMany({
          where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        });
        if (claimed.count === 0) throw inviteInvalid();

        const invitation = await tx.invitation.findUniqueOrThrow({
          where: { tokenHash },
          include: { employee: true },
        });
        const { employee } = invitation;
        if (employee.userId || !employee.email) throw inviteInvalid();

        const created = await tx.user.create({
          data: {
            companyId: invitation.companyId,
            role: 'EMPLOYEE',
            name: input.name,
            email: employee.email,
            phone: employee.phone,
            passwordHash,
          },
        });
        await tx.employee.update({
          where: { id: employee.id },
          data: { userId: created.id, name: input.name },
        });
        await this.audit.record(
          { companyId: invitation.companyId, actorUserId: created.id, action: 'invitation.accepted', entityType: 'invitation', entityId: invitation.id },
          tx,
        );
        return created;
      });
      return await this.tokens.issue(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'EMAIL_TAKEN', 'This email already has a Work Trail account. Ask your admin to use a different email.');
      }
      throw e;
    }
  }
```
Add the module-level helper next to `inviteInvalid`:
```ts
const isUsable = (i: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) =>
  !i.acceptedAt && !i.revokedAt && i.expiresAt > new Date();
```
Postgres serialises two concurrent `UPDATE … WHERE accepted_at IS NULL` statements on the same row. The second one re-checks the condition after the first commits and updates 0 rows, so exactly one claim succeeds.

`src/modules/invitations/controllers/accept-invitation.controller.ts`:
```ts
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AcceptInvitationInput, AcceptInvitationSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import { InvitationsService } from '../services/invitations.service.js';

const LIMIT = { default: { limit: process.env.NODE_ENV === 'test' ? 10_000 : 20, ttl: 60_000 } };

/** Reached from the invite link, before the employee has an account. */
@Public()
@Throttle(LIMIT)
@Controller('employees/invitations')
export class AcceptInvitationController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(
    @Param('token') token: string,
    @Body(new ZodBody(AcceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.invitations.accept(token, body);
  }
}
```
Add `AcceptInvitationController` to `controllers` in `invitations.module.ts`. Check that the class-level `@Public()` is honoured: `JwtAuthGuard` reads `IS_PUBLIC` with `getAllAndOverride([handler, class])`, so it is.

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint`
Expected: PASS (e2e 40). Clean.

- [ ] **Step 5: Commit.**
```bash
git add apps/api
git commit -m "feat(api): preview and accept invitations (single-use, race-safe)"
```

---

### Task 5: Forgot and reset password (API)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add `PasswordResetToken`; relation on `User`), `apps/api/src/modules/auth/controllers/auth.controller.ts`, `apps/api/src/modules/auth/auth.module.ts`
- Create: migration `password_reset_tokens`, `apps/api/src/modules/auth/services/password-reset.service.ts`
- Test: `apps/api/test/e2e/password-reset.e2e-spec.ts`

**Interfaces:**
- Consumes: `ForgotPasswordSchema`, `ResetPasswordSchema` (Task 1), `Mailer`, `AuditService`, `newToken`, `sha256` (Task 2), `hashPassword`.
- Produces:
  - `POST /api/v1/auth/forgot-password` `{ email }` → always 204.
  - `POST /api/v1/auth/reset-password` `{ token, password }` → 204, or 400 `RESET_LINK_INVALID`.
  - Reset link format: `${WEB_ORIGIN}/reset-password?token=<43 chars>`.

- [ ] **Step 1: Schema and migration.** Add to `schema.prisma`:
```prisma
model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  usedAt    DateTime? @map("used_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```
In `model User`, add `passwordResetTokens PasswordResetToken[]` under `refreshTokens`. Then run:
```bash
cd apps/api && node scripts/with-env.mjs prisma migrate dev --name password_reset_tokens && pnpm db:test:migrate && cd ../..
```

- [ ] **Step 2: Write the failing test.** Create `apps/api/test/e2e/password-reset.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';
import { lastMailTo, linkIn, outbox } from '../helpers/mail.js';

const prisma = new PrismaClient();

describe('password reset', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const forgot = (email: string) => http().post('/api/v1/auth/forgot-password').send({ email });
  const reset = (token: string, password = 'NewStrongPass2') =>
    http().post('/api/v1/auth/reset-password').send({ token, password });

  async function requestLink() {
    const a = await signupAs(app);
    await forgot(a.user.email).expect(204);
    const link = linkIn(lastMailTo(app, a.user.email))!;
    return { a, token: new URL(link).searchParams.get('token')! , link };
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    outbox(app).sent.length = 0;
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('emails a 1-hour reset link to a known address', async () => {
    const { link, a } = await requestLink();
    expect(link).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=[\w-]{43}$/);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: a.user.id } });
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('answers an unknown email exactly the same way and sends nothing', async () => {
    const res = await forgot('nobody@example.com').expect(204);
    expect(res.text).toBe('');
    expect(outbox(app).sent).toHaveLength(0);
  });

  it('reset sets the new password, ends every session and is audited', async () => {
    const { a, token } = await requestLink();
    const login = await http().post('/api/v1/auth/login').send({ email: a.user.email, password: 'StrongPass1' });
    await reset(token).expect(204);
    await http().post('/api/v1/auth/login').send({ email: a.user.email, password: 'StrongPass1' }).expect(401);
    await http().post('/api/v1/auth/login').send({ email: a.user.email, password: 'NewStrongPass2' }).expect(200);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(401);
    expect(await prisma.auditLog.count({ where: { action: 'password.reset', entityId: a.user.id } })).toBe(1);
  });

  it('a reset link works once', async () => {
    const { token } = await requestLink();
    await reset(token).expect(204);
    const again = await reset(token, 'AnotherPass3').expect(400);
    expect(again.body.error).toMatchObject({
      code: 'RESET_LINK_INVALID',
      message: 'This reset link has expired or was already used. Request a new one.',
    });
  });

  it('an expired link is refused', async () => {
    const { token } = await requestLink();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await reset(token).expect(400);
  });

  it('a newer link replaces older unused ones', async () => {
    const { a, token: first } = await requestLink();
    await forgot(a.user.email).expect(204);
    const second = new URL(linkIn(lastMailTo(app, a.user.email))!).searchParams.get('token')!;
    await reset(second).expect(204);
    await reset(first, 'AnotherPass3').expect(400);
  });

  it('a weak new password is a field error', async () => {
    const { token } = await requestLink();
    const res = await reset(token, 'short').expect(400);
    expect(res.body.error.details.fields.password).toBe('Use at least 8 characters.');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails.**
Run: `cd apps/api && pnpm exec vitest run --config vitest.config.e2e.ts test/e2e/password-reset`
Expected: FAIL (404 on `/auth/forgot-password`).

- [ ] **Step 4: Implement.**

`src/modules/auth/services/password-reset.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { Mailer } from '../../../common/mail/mailer.js';
import { newToken, sha256 } from '../../../common/utils/secure-token.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { hashPassword } from '../utils/password.js';

export const RESET_TTL_MINUTES = 60;

const linkInvalid = () =>
  new AppError(400, 'RESET_LINK_INVALID', 'This reset link has expired or was already used. Request a new one.');

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Always resolves the same way, so callers can't learn which emails have accounts. */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = newToken();
    await this.prisma.$transaction([
      // Only the newest link works.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: addMinutes(new Date(), RESET_TTL_MINUTES) },
      }),
    ]);

    await this.mailer
      .send({
        to: user.email,
        subject: 'Reset your Work Trail password',
        text: [
          `Hi ${user.name},`,
          '',
          'Open this link to choose a new password. It works once and expires in 1 hour:',
          `${this.env.WEB_ORIGIN}/reset-password?token=${token}`,
          '',
          "If you didn't ask for this, ignore this email. Your password stays the same.",
        ].join('\n'),
      })
      .catch(() => undefined);
  }

  /** Sets the new password and signs the user out everywhere. */
  async reset(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw linkInvalid();

      const row = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        include: { user: true },
      });
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        { companyId: row.user.companyId, actorUserId: row.userId, action: 'password.reset', entityType: 'user', entityId: row.userId },
        tx,
      );
    });
  }
}
```

In `auth.module.ts`, add `PasswordResetService` to `providers`. In `auth.controller.ts`, add `PasswordResetService` to the constructor, import `ForgotPasswordSchema`, `ResetPasswordSchema`, `type ForgotPasswordInput` and `type ResetPasswordInput` from `@worktrail/types`, and add:
```ts
  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(@Body(new ZodBody(ForgotPasswordSchema)) body: ForgotPasswordInput) {
    await this.passwordReset.request(body.email);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body(new ZodBody(ResetPasswordSchema)) body: ResetPasswordInput) {
    await this.passwordReset.reset(body.token, body.password);
  }
```

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint`
Expected: PASS (e2e 47). Clean.

- [ ] **Step 6: Commit.**
```bash
git add apps/api
git commit -m "feat(api): forgot/reset password with single-use 1-hour links"
```

---

### Task 6: Employees page (web)

**Files:**
- Create: `apps/web/src/lib/employees-query.ts`, `apps/web/src/components/employees/status-chip.tsx`, `apps/web/src/components/employees/employees-toolbar.tsx`, `apps/web/src/components/employees/employee-table.tsx`, `apps/web/src/components/employees/pagination.tsx`, `apps/web/src/app/app/employees/page.tsx`
- Test: `apps/web/test/employees-query.test.ts`, `apps/web/test/employees.test.tsx`

**Interfaces:**
- Consumes: `EmployeeListResponse`, `EmployeeListItem` (Task 1), `serverApi` (Phase 0–1), `GET /api/v1/employees`.
- Produces:
  - `parseEmployeesQuery(sp: Record<string, string | string[] | undefined>): EmployeesQuery`, where `EmployeesQuery = { query: string; status: 'ALL' | 'WORKING' | 'OFF_DUTY'; page: number }`
  - `toApiSearch(q): string`
  - `employeesHref(q, patch?): string`
  - `EmployeeTable({ items, resend?: (id) => Promise<…> })` (the resend button arrives in Task 7; this task takes an optional `actions` render prop)
  - Route: `/app/employees`

- [ ] **Step 1: Write the failing tests.**

`apps/web/test/employees-query.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { employeesHref, parseEmployeesQuery, toApiSearch } from '@/lib/employees-query';

describe('employees query', () => {
  it('parses and cleans search params', () => {
    expect(parseEmployeesQuery({ q: '  ravi ', status: 'WORKING', page: '3' })).toEqual({ query: 'ravi', status: 'WORKING', page: 3 });
    expect(parseEmployeesQuery({ status: 'nope', page: '-2' })).toEqual({ query: '', status: 'ALL', page: 1 });
    expect(parseEmployeesQuery({ q: ['a', 'b'] }).query).toBe('a');
  });

  it('builds the API search string, omitting defaults', () => {
    expect(toApiSearch({ query: '', status: 'ALL', page: 1 })).toBe('?page=1&pageSize=20');
    expect(toApiSearch({ query: 'ravi', status: 'OFF_DUTY', page: 2 })).toBe('?query=ravi&status=OFF_DUTY&page=2&pageSize=20');
  });

  it('builds page links and resets to page 1 when the filter changes', () => {
    const q = { query: 'ravi', status: 'ALL' as const, page: 4 };
    expect(employeesHref(q, { page: 5 })).toBe('/app/employees?q=ravi&page=5');
    expect(employeesHref(q, { status: 'WORKING' })).toBe('/app/employees?q=ravi&status=WORKING');
  });
});
```

`apps/web/test/employees.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmployeeListItem } from '@worktrail/types';
import { EmployeeTable } from '@/components/employees/employee-table';
import { Pagination } from '@/components/employees/pagination';

const base: EmployeeListItem = { id: '1', name: 'Amit Kumar', designation: 'Field Sales', employeeCode: 'FT-101', email: 'amit@x.in', status: 'WORKING', account: 'ACTIVE' };

describe('EmployeeTable', () => {
  it('shows one clear status per person', () => {
    render(
      <EmployeeTable
        items={[
          base,
          { ...base, id: '2', name: 'Neha Patel', status: 'OFF_DUTY' },
          { ...base, id: '3', name: 'Ravi Kumar', status: 'OFF_DUTY', account: 'INVITED' },
        ]}
      />,
    );
    const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });
    expect(within(row('Amit Kumar')).getByText('Working')).toBeInTheDocument();
    expect(within(row('Neha Patel')).getByText('Off duty')).toBeInTheDocument();
    expect(within(row('Ravi Kumar')).getByText('Invite pending')).toBeInTheDocument();
  });

  it('renders the row actions slot only for pending invites', () => {
    render(
      <EmployeeTable
        items={[base, { ...base, id: '3', name: 'Ravi Kumar', account: 'INVITED' }]}
        pendingAction={(e) => <button type="button">Resend {e.name}</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Resend Ravi Kumar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend Amit Kumar' })).toBeNull();
  });

  it('invites action when the team is empty', () => {
    render(<EmployeeTable items={[]} />);
    expect(screen.getByText('No employees yet. Invite your first employee to start tracking work sessions.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite employee' })).toHaveAttribute('href', '/app/employees/new');
  });
});

describe('Pagination', () => {
  it('shows the range and disables links at the ends', () => {
    render(<Pagination query={{ query: '', status: 'ALL', page: 1 }} pageSize={20} total={45} />);
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/app/employees?page=2');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.**
Run: `pnpm --filter @worktrail/web test`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement.**

`src/lib/employees-query.ts`:
```ts
export type StatusFilter = 'ALL' | 'WORKING' | 'OFF_DUTY';
export type EmployeesQuery = { query: string; status: StatusFilter; page: number };

export const PAGE_SIZE = 20;
type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseEmployeesQuery(sp: SearchParams): EmployeesQuery {
  const status = first(sp.status);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    query: first(sp.q).trim(),
    status: status === 'WORKING' || status === 'OFF_DUTY' ? status : 'ALL',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Query string for GET /api/v1/employees. */
export function toApiSearch(q: EmployeesQuery): string {
  const p = new URLSearchParams();
  if (q.query) p.set('query', q.query);
  if (q.status !== 'ALL') p.set('status', q.status);
  p.set('page', String(q.page));
  p.set('pageSize', String(PAGE_SIZE));
  return `?${p}`;
}

/** Link to the employees page with some filters changed. Changing a filter resets the page. */
export function employeesHref(q: EmployeesQuery, patch: Partial<EmployeesQuery> = {}): string {
  const next = { ...q, ...patch };
  if (patch.status !== undefined || patch.query !== undefined) next.page = patch.page ?? 1;
  const p = new URLSearchParams();
  if (next.query) p.set('q', next.query);
  if (next.status !== 'ALL') p.set('status', next.status);
  if (next.page > 1) p.set('page', String(next.page));
  const s = p.toString();
  return s ? `/app/employees?${s}` : '/app/employees';
}
```

`src/components/employees/status-chip.tsx`:
```tsx
import type { EmployeeListItem } from '@worktrail/types';
import { cn } from '@/lib/cn';

const STYLES = {
  WORKING: { label: 'Working', className: 'bg-success-50 text-success-500', dot: 'bg-success-500' },
  OFF_DUTY: { label: 'Off duty', className: 'bg-canvas text-ink-500', dot: 'bg-ink-300' },
  INVITED: { label: 'Invite pending', className: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
} as const;

export function StatusChip({ employee }: { employee: Pick<EmployeeListItem, 'status' | 'account'> }) {
  const s = STYLES[employee.account === 'INVITED' ? 'INVITED' : employee.status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
```

`src/components/employees/employee-table.tsx`:
```tsx
import Link from 'next/link';
import type { EmployeeListItem } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';
import { StatusChip } from './status-chip';

type Props = {
  items: EmployeeListItem[];
  /** Extra control for people who haven't accepted their invite yet (e.g. resend). */
  pendingAction?: (employee: EmployeeListItem) => React.ReactNode;
};

export function EmployeeTable({ items, pendingAction }: Props) {
  if (items.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="mx-auto max-w-[44ch] text-ink-500">
          No employees yet. Invite your first employee to start tracking work sessions.
        </p>
        <Link href="/app/employees/new" className="mt-4 inline-flex h-11 items-center rounded-input bg-cta px-5 text-sm font-semibold text-white">
          Invite employee
        </Link>
      </div>
    );
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-ink-500">
        <tr>
          <th scope="col" className="px-5 py-3 font-medium">Name</th>
          <th scope="col" className="px-5 py-3 font-medium max-md:hidden">Employee ID</th>
          <th scope="col" className="px-5 py-3 font-medium max-md:hidden">Email</th>
          <th scope="col" className="px-5 py-3 font-medium">Status</th>
          <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((e) => (
          <tr key={e.id}>
            <th scope="row" className="px-5 py-3 font-normal">
              <span className="flex items-center gap-3">
                <Avatar name={e.name} size={32} />
                <span>
                  <span className="block font-semibold text-ink-900">{e.name}</span>
                  <span className="block text-xs text-ink-500">{e.designation ?? 'No designation'}</span>
                </span>
              </span>
            </th>
            <td className="px-5 py-3 text-ink-700 max-md:hidden">{e.employeeCode ?? '—'}</td>
            <td className="px-5 py-3 text-ink-700 max-md:hidden">{e.email ?? '—'}</td>
            <td className="px-5 py-3"><StatusChip employee={e} /></td>
            <td className="px-5 py-3 text-right">{e.account === 'INVITED' ? pendingAction?.(e) : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`src/components/employees/pagination.tsx`:
```tsx
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { employeesHref, type EmployeesQuery } from '@/lib/employees-query';

type Props = { query: EmployeesQuery; pageSize: number; total: number };

const linkClass = 'grid size-9 place-items-center rounded-input border border-line text-ink-700 hover:bg-brand-50';

export function Pagination({ query, pageSize, total }: Props) {
  if (total === 0) return null;
  const from = (query.page - 1) * pageSize + 1;
  const to = Math.min(query.page * pageSize, total);
  const hasPrev = query.page > 1;
  const hasNext = to < total;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-500">
      <span>{from}–{to} of {total}</span>
      <span className="flex gap-2">
        {hasPrev ? (
          <Link href={employeesHref(query, { page: query.page - 1 })} aria-label="Previous page" className={linkClass}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={employeesHref(query, { page: query.page + 1 })} aria-label="Next page" className={linkClass}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
```

`src/components/employees/employees-toolbar.tsx`:
```tsx
import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { employeesHref, type EmployeesQuery, type StatusFilter } from '@/lib/employees-query';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'WORKING', label: 'Working' },
  { value: 'OFF_DUTY', label: 'Off duty' },
];

/** Search (a plain GET form, works without JS) and status filter links. */
export function EmployeesToolbar({ query }: { query: EmployeesQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-5">
      <form action="/app/employees" className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-input border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-brand-500">
        <Search className="size-[18px] text-ink-300" aria-hidden />
        <label htmlFor="employee-search" className="sr-only">Search employees by name</label>
        <input id="employee-search" name="q" defaultValue={query.query} placeholder="Search by name" className="h-full flex-1 bg-transparent text-sm outline-none" />
        {query.status !== 'ALL' ? <input type="hidden" name="status" value={query.status} /> : null}
      </form>
      <nav aria-label="Filter by status" className="flex gap-1 rounded-input border border-line bg-surface p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={employeesHref(query, { status: f.value })}
            aria-current={query.status === f.value ? 'page' : undefined}
            className={cn(
              'rounded-[9px] px-3 py-1.5 text-sm font-semibold',
              query.status === f.value ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

`src/app/app/employees/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import type { EmployeeListResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { EmployeeTable } from '@/components/employees/employee-table';
import { EmployeesToolbar } from '@/components/employees/employees-toolbar';
import { Pagination } from '@/components/employees/pagination';
import { parseEmployeesQuery, toApiSearch } from '@/lib/employees-query';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Employees · Work Trail' };

export default async function EmployeesPage({ searchParams }: PageProps<'/app/employees'>) {
  const query = parseEmployeesQuery(await searchParams);
  const data = await serverApi<EmployeeListResponse>(`/employees${toApiSearch(query)}`);
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight">Employees</h1>
          <p className="mt-1 text-ink-500">Everyone on your team, and who is working right now.</p>
        </div>
        <Link href="/app/employees/new" className="inline-flex h-11 items-center gap-2 rounded-input bg-cta px-5 text-sm font-semibold text-white">
          <UserPlus className="size-[18px]" aria-hidden />
          Invite employee
        </Link>
      </div>
      <Card className="overflow-hidden">
        <EmployeesToolbar query={query} />
        <EmployeeTable items={data.items} />
        <Pagination query={query} pageSize={data.pageSize} total={data.total} />
      </Card>
    </div>
  );
}
```
(Task 7 adds `pendingAction` with the resend button.) If the search returns nothing, `EmployeeTable` shows the "No employees yet" message. That's only accurate with no filter, so pass `items` together with the filter state: change the empty branch to take `filtered?: boolean`. When it's true, render "No employees match this search." and a link to `/app/employees` reading "Clear filters". Add this test to `employees.test.tsx`:
```tsx
  it('says when a search matched no one, instead of the first-run message', () => {
    render(<EmployeeTable items={[]} filtered />);
    expect(screen.getByText('No employees match this search.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/app/employees');
  });
```
Implement it in `EmployeeTable` (prop `filtered?: boolean`; the empty branch checks `filtered` first), and pass `filtered={query.query !== '' || query.status !== 'ALL'}` from the page.

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint`
Expected: PASS. Clean.

- [ ] **Step 5: Commit.**
```bash
git add apps/web
git commit -m "feat(web): employees page with search, status filter and pagination"
```

---

### Task 7: Invite and re-send from the web (Server Actions)

**Files:**
- Modify: `apps/web/src/lib/server-api.ts` (add `serverMutate`), `apps/web/src/app/app/employees/page.tsx` (resend button)
- Create: `apps/web/src/app/app/employees/actions.ts`, `apps/web/src/app/app/employees/new/page.tsx`, `apps/web/src/components/employees/invite-form.tsx`, `apps/web/src/components/employees/invite-link-panel.tsx`, `apps/web/src/components/employees/resend-invite-button.tsx`
- Test: `apps/web/test/invite.test.tsx`

**Interfaces:**
- Consumes: `InviteEmployeeSchema`, `InvitationCreated` (Task 1), `POST /employees/invitations`, `POST /employees/:id/invitations` (Task 3), `Field`, `Input`, `Button`, `FormAlert`.
- Produces:
  - `serverMutate<T>(path, body?): Promise<MutationResult<T>>`, where `MutationResult<T> = { ok: true; data: T } | { ok: false; message: string; fields: Record<string,string> }`
  - Server Actions `inviteEmployee(values): Promise<MutationResult<InvitationCreated>>` and `resendInvite(employeeId): Promise<MutationResult<InvitationCreated>>`
  - `InviteForm({ action })`, `InviteLinkPanel({ invitation, name })`, `ResendInviteButton({ employeeId, name, action })`
  - Route: `/app/employees/new`

- [ ] **Step 1: Check the Next 16 Server Actions API before writing code.** (AGENTS.md: "This is NOT the Next.js you know".)
Run: `grep -rn "revalidatePath\|'use server'" apps/web/node_modules/next/dist/docs/01-app/01-getting-started/*mutating* | head -20`
Expected: confirms the `'use server'` file directive and `revalidatePath` from `next/cache`. If either has been renamed, use the documented name and ledger it as a ruling.

- [ ] **Step 2: Write the failing tests.** Create `apps/web/test/invite.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvitationCreated } from '@worktrail/types';
import { InviteForm } from '@/components/employees/invite-form';
import { ResendInviteButton } from '@/components/employees/resend-invite-button';

const created: InvitationCreated = {
  employeeId: 'e1',
  inviteUrl: 'http://localhost:3000/invite/abc',
  expiresAt: '2026-10-11T10:00:00.000Z',
  emailSent: true,
};
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.clearAllMocks());

async function fill() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Ravi Kumar');
  await userEvent.type(screen.getByLabelText('Email address'), 'ravi@example.com');
  await userEvent.type(screen.getByLabelText(/Mobile number/), '98765 43210');
}

describe('InviteForm', () => {
  it('validates before calling the server', async () => {
    const action = vi.fn();
    render(<InviteForm action={action} />);
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText("Enter the employee's name.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it('sends normalised values and then shows the link to share', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: created });
    render(<InviteForm action={action} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ email: 'ravi@example.com', phone: '+919876543210' }));
    expect(await screen.findByText('Invite sent to Ravi Kumar')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invite link' })).toHaveValue(created.inviteUrl);
    const wa = screen.getByRole('link', { name: 'Share on WhatsApp' });
    expect(wa.getAttribute('href')).toBe(
      `https://wa.me/?text=${encodeURIComponent(`Join our team on Work Trail. Set your password here: ${created.inviteUrl}`)}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(created.inviteUrl);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('says when the email could not be sent, so the admin shares the link', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: { ...created, emailSent: false } });
    render(<InviteForm action={action} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText(/couldn't email the invite/i)).toBeInTheDocument();
  });

  it('puts a server error on the right field', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: 'x', fields: { email: 'This email already has a Work Trail account. Use a different email.' } });
    render(<InviteForm action={action} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByLabelText('Email address')).toHaveAccessibleDescription(
      'This email already has a Work Trail account. Use a different email.',
    );
  });

  it('shows a server error that has no field', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: 'This person is already on your team.', fields: {} });
    render(<InviteForm action={action} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This person is already on your team.');
  });
});

describe('ResendInviteButton', () => {
  it('creates a new link and copies it', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: created });
    render(<ResendInviteButton employeeId="e1" name="Ravi Kumar" action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy new invite link for Ravi Kumar' }));
    expect(action).toHaveBeenCalledWith('e1');
    expect(writeText).toHaveBeenCalledWith(created.inviteUrl);
    expect(await screen.findByText('New link copied')).toBeInTheDocument();
  });

  it('shows the failure next to the button', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: 'This employee has already set up their account.', fields: {} });
    render(<ResendInviteButton employeeId="e1" name="Ravi Kumar" action={action} />);
    await userEvent.click(screen.getByRole('button', { name: /copy new invite link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This employee has already set up their account.');
  });
});
```

- [ ] **Step 3: Run them and confirm they fail.**
Run: `pnpm --filter @worktrail/web test`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement.**

Append to `src/lib/server-api.ts`:
```ts
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string> };

/** Authenticated POST from a Server Action. Returns API errors as data so forms can show them. */
export async function serverMutate<T>(path: string, body: unknown = {}): Promise<MutationResult<T>> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) redirect('/api/session/expired');
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: 'Work Trail is not reachable right now. Try again in a moment.', fields: {} };
  }
  if (res.status === 401) redirect('/api/session/expired');
  const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: json as T };
  const err = (json as ApiErrorBody | null)?.error;
  return {
    ok: false,
    message: err?.message ?? 'Something went wrong. Try again.',
    fields: (err?.details?.fields as Record<string, string> | undefined) ?? {},
  };
}
```

`src/app/app/employees/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { InvitationCreated, InviteEmployeeInput } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function inviteEmployee(values: InviteEmployeeInput) {
  const result = await serverMutate<InvitationCreated>('/employees/invitations', values);
  if (result.ok) revalidatePath('/app/employees');
  return result;
}

export async function resendInvite(employeeId: string) {
  return serverMutate<InvitationCreated>(`/employees/${encodeURIComponent(employeeId)}/invitations`);
}
```

`src/components/employees/invite-link-panel.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import type { InvitationCreated } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';

export function whatsappHref(inviteUrl: string) {
  const text = `Join our team on Work Trail. Set your password here: ${inviteUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Shown after an invite is created: the link, plus copy and WhatsApp share. */
export function InviteLinkPanel({ invitation, name }: { invitation: InvitationCreated; name: string }) {
  const [copied, setCopied] = useState(false);
  const expires = formatInTimeZone(new Date(invitation.expiresAt), 'Asia/Kolkata', 'd MMM yyyy');
  const copy = async () => {
    await navigator.clipboard.writeText(invitation.inviteUrl);
    setCopied(true);
  };
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">Invite sent to {name}</h2>
      <p className="text-ink-500">
        {invitation.emailSent
          ? `We emailed the link. You can also share it on WhatsApp. It works once and expires on ${expires}.`
          : `We couldn't email the invite, so share this link with ${name} yourself. It works once and expires on ${expires}.`}
      </p>
      <label htmlFor="invite-link" className="block text-sm font-medium text-ink-900">Invite link</label>
      <div className="flex gap-2">
        <input id="invite-link" readOnly value={invitation.inviteUrl} onFocus={(e) => e.currentTarget.select()} className="h-12 min-w-0 flex-1 rounded-input border border-line bg-canvas px-3 text-sm text-ink-700" />
        <button type="button" onClick={copy} className="inline-flex h-12 items-center gap-2 rounded-input border border-brand-200 bg-surface px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <a href={whatsappHref(invitation.inviteUrl)} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-input bg-success-500 px-5 text-sm font-semibold text-white">
        <MessageCircle className="size-[18px]" aria-hidden />
        Share on WhatsApp
      </a>
    </div>
  );
}
```

`src/components/employees/invite-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { BadgeCheck, Briefcase, Mail, Smartphone, User } from 'lucide-react';
import { type InvitationCreated, InviteEmployeeSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/server-api';
import { InviteLinkPanel } from './invite-link-panel';

type FormIn = z.input<typeof InviteEmployeeSchema>;
type FormOut = z.output<typeof InviteEmployeeSchema>;
type Props = { action: (values: FormOut) => Promise<MutationResult<InvitationCreated>> };

export function InviteForm({ action }: Props) {
  const [created, setCreated] = useState<{ invitation: InvitationCreated; name: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(InviteEmployeeSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values);
    if (result.ok) return setCreated({ invitation: result.data, name: values.name });
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) setError(name as keyof FormIn, { message });
    if (fields.length === 0) setFormError(result.message);
  });

  if (created) return <InviteLinkPanel invitation={created.invitation} name={created.name} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Full name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" icon={User} placeholder="e.g. Ravi Kumar" autoComplete="off" {...register('name')} />
      </Field>
      <Field label="Email address" htmlFor="email" error={errors.email?.message} hint="They sign in to the Work Trail app with this email">
        <Input id="email" type="email" icon={Mail} placeholder="ravi@example.com" autoComplete="off" {...register('email')} />
      </Field>
      <Field label="Mobile number (optional)" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" type="tel" inputMode="tel" icon={Smartphone} prefix="+91" placeholder="Enter mobile number" {...register('phone')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation (optional)" htmlFor="designation" error={errors.designation?.message}>
          <Input id="designation" icon={Briefcase} placeholder="e.g. Field Technician" {...register('designation')} />
        </Field>
        <Field label="Employee ID (optional)" htmlFor="employeeCode" error={errors.employeeCode?.message}>
          <Input id="employeeCode" icon={BadgeCheck} placeholder="e.g. FT-101" {...register('employeeCode')} />
        </Field>
      </div>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>Send invite</Button>
    </form>
  );
}
```

`src/components/employees/resend-invite-button.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { InvitationCreated } from '@worktrail/types';
import type { MutationResult } from '@/lib/server-api';

type Props = {
  employeeId: string;
  name: string;
  action: (employeeId: string) => Promise<MutationResult<InvitationCreated>>;
};

/** Issues a fresh invite link (the old one stops working) and copies it. */
export function ResendInviteButton({ employeeId, name, action }: Props) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'copied' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const run = async () => {
    setState({ kind: 'busy' });
    const result = await action(employeeId);
    if (!result.ok) return setState({ kind: 'error', message: result.message });
    await navigator.clipboard.writeText(result.data.inviteUrl).catch(() => undefined);
    setState({ kind: 'copied' });
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={state.kind === 'busy'}
        aria-label={`Copy new invite link for ${name}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-input px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
      >
        <Link2 className="size-4" aria-hidden />
        {state.kind === 'copied' ? 'New link copied' : 'Copy new invite link'}
      </button>
      {state.kind === 'error' ? <span role="alert" className="text-xs text-danger-500">{state.message}</span> : null}
    </span>
  );
}
```
The client components import only the `MutationResult` **type** from `server-api.ts`. That file imports `server-only`, so type-only imports are required: `import type`. To avoid any bundling ambiguity, move `MutationResult` into `src/lib/mutation-result.ts` (types only) and import it from there in `server-api.ts` and in the client components.

`src/app/app/employees/new/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { InviteForm } from '@/components/employees/invite-form';
import { inviteEmployee } from '../actions';

export const metadata: Metadata = { title: 'Invite employee · Work Trail' };

export default function InviteEmployeePage() {
  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <Link href="/app/employees" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden />
        Employees
      </Link>
      <div>
        <h1 className="text-[28px] leading-tight">Invite employee</h1>
        <p className="mt-1 text-ink-500">They get a link to set a password, then sign in on the Work Trail app.</p>
      </div>
      <Card className="p-6 sm:p-8">
        <InviteForm action={inviteEmployee} />
      </Card>
    </div>
  );
}
```

In `src/app/app/employees/page.tsx`, import `ResendInviteButton` and `resendInvite`, and pass a `pendingAction` to the table:
```tsx
<EmployeeTable
  items={data.items}
  filtered={query.query !== '' || query.status !== 'ALL'}
  pendingAction={(e) => <ResendInviteButton employeeId={e.id} name={e.name} action={resendInvite} />}
/>
```
`EmployeeTable` is a Server Component that receives a function prop from the page (also server). It calls the function on the server and renders the resulting client element, so this is allowed.

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint`
Expected: PASS. Clean.

- [ ] **Step 6: Commit.**
```bash
git add apps/web
git commit -m "feat(web): invite employees with copy/WhatsApp link and resend"
```

---

### Task 8: Public pages for forgot password, reset password and accepting an invite; block employee web sign-in

**Files:**
- Modify: `apps/web/src/app/api/session/[action]/route.ts`, `apps/web/src/proxy.ts` (matcher for the new public auth pages)
- Create: `apps/web/src/lib/public-api.ts`, `apps/web/src/components/auth/forgot-password-form.tsx`, `apps/web/src/components/auth/reset-password-form.tsx`, `apps/web/src/components/auth/accept-invite-form.tsx`, `apps/web/src/app/(auth)/forgot-password/page.tsx`, `apps/web/src/app/(auth)/reset-password/page.tsx`, `apps/web/src/app/(auth)/invite/[token]/page.tsx`
- Test: `apps/web/test/session-route.test.ts` (extend), `apps/web/test/public-auth-forms.test.tsx`

**Interfaces:**
- Consumes: `ForgotPasswordSchema`, `ResetPasswordSchema`, `AcceptInvitationSchema`, `InvitationPreview` (Task 1), the API endpoints from Tasks 4–5, `submitJson`, `AuthPanel`, `PasswordInput`, `FormAlert`.
- Produces:
  - `POST /api/session/forgot-password` → 204 passthrough.
  - `POST /api/session/reset-password` → 204 passthrough.
  - `POST /api/session/accept-invite` `{ token, name, password }` → `{ user: { name, email } }`. **Sets no cookies.**
  - Login/signup with an EMPLOYEE account → 403 `USE_MOBILE_APP`, no cookies, and the issued refresh token is revoked.
  - `publicGet<T>(path)` → `{ ok: true; data: T } | { ok: false; status: number }`.
  - Routes: `/forgot-password`, `/reset-password?token=…`, `/invite/[token]`.

- [ ] **Step 1: Write the failing tests.**

Append to `apps/web/test/session-route.test.ts` (inside the `describe`):
```ts
  it('refuses EMPLOYEE accounts on the admin web, revokes the token and sets no cookies', async () => {
    const employeeTokens = { ...tokens, user: { ...tokens.user, role: 'EMPLOYEE' } };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(employeeTokens))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await call('login', { email: 'r@a.in', password: 'x' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toEqual({
      code: 'USE_MOBILE_APP',
      message: 'This sign-in is for company admins. Employees sign in on the Work Trail app.',
      details: {},
    });
    expect(res.headers.getSetCookie()).toHaveLength(0);
    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/auth\/logout$/);
  });

  it('forgot-password passes the 204 straight through', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const res = await call('forgot-password', { email: 'r@a.in' });
    expect(res.status).toBe(204);
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/auth\/forgot-password$/);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('accept-invite forwards name+password to the token URL and sets no cookies', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ ...tokens, user: { ...tokens.user, role: 'EMPLOYEE' } }));
    const res = await call('accept-invite', { token: 'tok_123', name: 'Ravi', password: 'StrongPass1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/employees\/invitations\/tok_123\/accept$/);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ name: 'Ravi', password: 'StrongPass1' });
    expect(await res.json()).toEqual({ user: { name: 'Rahul', email: 'r@a.in' } });
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
```

Create `apps/web/test/public-auth-forms.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';

afterEach(() => vi.restoreAllMocks());

describe('ForgotPasswordForm', () => {
  it('confirms without revealing whether the account exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'r@a.in');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText('If r@a.in has a Work Trail account, a reset link is on its way. It expires in 1 hour.')).toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  it('checks that both passwords match before calling the server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<ResetPasswordForm token="t".repeat(43)} />);
    await userEvent.type(screen.getByLabelText('New password'), 'NewStrongPass2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different1');
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirms the change and links to sign-in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<ResetPasswordForm token={'t'.repeat(43)} />);
    await userEvent.type(screen.getByLabelText('New password'), 'NewStrongPass2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewStrongPass2');
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByText('Password saved. Sign in with your new password.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the expired-link message from the server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { code: 'RESET_LINK_INVALID', message: 'This reset link has expired or was already used. Request a new one.', details: {} } }, { status: 400 }),
    );
    render(<ResetPasswordForm token={'t'.repeat(43)} />);
    await userEvent.type(screen.getByLabelText('New password'), 'NewStrongPass2');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewStrongPass2');
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link has expired or was already used. Request a new one.');
  });
});

describe('AcceptInviteForm', () => {
  const preview = { companyName: 'Acme Services', employeeName: 'Ravi Kumar', email: 'ravi@example.com', expiresAt: '2026-10-11T00:00:00Z' };

  it('pre-fills the name and, after accepting, points to the app', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ user: { name: 'Ravi Kumar', email: 'ravi@example.com' } }));
    render(<AcceptInviteForm token="tok" preview={preview} />);
    expect(screen.getByLabelText('Your name')).toHaveValue('Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Create a password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: /join acme services/i }));
    expect(await screen.findByText("You're in, Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText(/sign in on the Work Trail app with ravi@example.com/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.**
Run: `pnpm --filter @worktrail/web test`
Expected: FAIL (routes return 404 for the new actions; form modules not found).

- [ ] **Step 3: Implement the session route.** Restructure `src/app/api/session/[action]/route.ts` so its `POST` dispatches on these tables (keep the existing `logout`, `GET expired` and `wantsToBeRemembered` unchanged):
```ts
/** Sign-in style actions: on success the API returns tokens and we set session cookies. */
const SESSION_TARGETS: Record<string, string> = {
  login: '/auth/login',
  signup: '/auth/signup/admin',
};
/** Public actions with no session: forward the request and pass the status/body back. */
const PASSTHROUGH_TARGETS: Record<string, string> = {
  'forgot-password': '/auth/forgot-password',
  'reset-password': '/auth/reset-password',
};

async function forward(path: string, body: string): Promise<Response | null> {
  try {
    return await fetch(apiUrl(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  } catch {
    return null;
  }
}

const unreachable = () =>
  NextResponse.json(
    errorBody('API_UNREACHABLE', 'Work Trail is not reachable right now. Check your connection and try again.'),
    { status: 503 },
  );

async function passthrough(apiRes: Response) {
  if (apiRes.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await apiRes.json().catch(() => null), { status: apiRes.status });
}

async function acceptInvite(rawBody: string) {
  let parsed: { token?: unknown; name?: unknown; password?: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = {};
  }
  const token = typeof parsed.token === 'string' ? parsed.token : '';
  if (!token) return NextResponse.json(errorBody('INVITE_INVALID', 'This invite link is incomplete.'), { status: 410 });
  const apiRes = await forward(
    `/employees/invitations/${encodeURIComponent(token)}/accept`,
    JSON.stringify({ name: parsed.name, password: parsed.password }),
  );
  if (!apiRes) return unreachable();
  if (!apiRes.ok) return passthrough(apiRes);
  const tokens = (await apiRes.json()) as AuthTokens;
  // Employees don't get an admin web session; they sign in on the mobile app.
  return NextResponse.json({ user: { name: tokens.user.name, email: tokens.user.email } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'logout') return logout(req);
  const rawBody = await req.text();
  if (action === 'accept-invite') return acceptInvite(rawBody);

  const passthroughPath = PASSTHROUGH_TARGETS[action];
  if (passthroughPath) {
    const apiRes = await forward(passthroughPath, rawBody);
    return apiRes ? passthrough(apiRes) : unreachable();
  }

  const target = SESSION_TARGETS[action];
  if (!target) return NextResponse.json(errorBody('NOT_FOUND', 'Not found.'), { status: 404 });
  const apiRes = await forward(target, rawBody);
  if (!apiRes) return unreachable();
  const body: unknown = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !body) return NextResponse.json(body, { status: apiRes.status });

  const tokens = body as AuthTokens;
  if (tokens.user.role === 'EMPLOYEE') {
    await forward('/auth/logout', JSON.stringify({ refreshToken: tokens.refreshToken }));
    return NextResponse.json(
      errorBody('USE_MOBILE_APP', 'This sign-in is for company admins. Employees sign in on the Work Trail app.'),
      { status: 403 },
    );
  }
  const res = NextResponse.json({ user: tokens.user });
  setSessionCookies(res.cookies, tokens, { persistent: wantsToBeRemembered(rawBody) });
  return res;
}
```
The previous inline `fetch`/503 code inside `POST` is replaced by `forward`/`unreachable`. The existing "returns a readable error when the API is unreachable" test still covers it.

- [ ] **Step 4: Implement the public pages.**

`src/lib/public-api.ts`:
```ts
import 'server-only';
import { apiUrl } from './api-url';

/** Unauthenticated GET from a Server Component (e.g. invite preview). */
export async function publicGet<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const res = await fetch(apiUrl(path), { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 503 };
  }
}
```

`src/components/auth/forgot-password-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { type ForgotPasswordInput, ForgotPasswordSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from './form-alert';
import { submitJson } from './submit-json';

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    const result = await submitJson('/api/session/forgot-password', { email });
    if (result.ok) return setSentTo(email);
    setFormError(result.message);
  });

  if (sentTo) {
    return (
      <p className="rounded-input bg-brand-50 p-4 text-ink-900">
        If {sentTo} has a Work Trail account, a reset link is on its way. It expires in 1 hour.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Email address" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" icon={Mail} placeholder="you@company.com" autoComplete="email" {...register('email')} />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>Send reset link</Button>
    </form>
  );
}
```

`src/components/auth/reset-password-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

const Schema = z
  .object({ password: PasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords do not match.' });
type Values = z.infer<typeof Schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(Schema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const result = await submitJson('/api/session/reset-password', { token, password });
    if (result.ok) return setDone(true);
    setFormError(result.fields.password ?? result.message);
  });

  if (done) {
    return (
      <p className="rounded-input bg-brand-50 p-4 text-ink-900">
        Password saved. Sign in with your new password.{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters">
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>Save new password</Button>
    </form>
  );
}
```

`src/components/auth/accept-invite-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Smartphone, User } from 'lucide-react';
import { type AcceptInvitationInput, AcceptInvitationSchema, type InvitationPreview } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

type Props = { token: string; preview: InvitationPreview };

export function AcceptInviteForm({ token, preview }: Props) {
  const [joined, setJoined] = useState<{ name: string; email: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(AcceptInvitationSchema),
    defaultValues: { name: preview.employeeName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitJson<{ user: { name: string; email: string } }>('/api/session/accept-invite', { token, ...values });
    if (result.ok) return setJoined(result.data.user);
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) setError(name as keyof AcceptInvitationInput, { message });
    if (fields.length === 0) setFormError(result.message);
  });

  if (joined) {
    return (
      <div className="space-y-3">
        <h2 className="text-2xl">You&apos;re in, {joined.name}</h2>
        <p className="flex gap-3 rounded-input bg-brand-50 p-4 text-ink-900">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden />
          Install Work Trail on your Android phone, then sign in on the Work Trail app with {joined.email} and the password you just created.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Your name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" icon={User} autoComplete="name" {...register('name')} />
      </Field>
      <Field label="Create a password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters">
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>Join {preview.companyName}</Button>
    </form>
  );
}
```

`src/app/(auth)/forgot-password/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password · Work Trail' };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          Remembered it? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
        </p>
        <div className="mx-auto mt-16 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Reset your password</h1>
          <p className="mb-8 mt-1 text-ink-500">Enter your email and we&apos;ll send you a link to choose a new password.</p>
          <ForgotPasswordForm />
        </div>
      </section>
    </>
  );
}
```

`src/app/(auth)/reset-password/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password · Work Trail' };

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20;
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <div className="mx-auto mt-16 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Choose a new password</h1>
          {valid ? (
            <>
              <p className="mb-8 mt-1 text-ink-500">This signs you out on every device.</p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <p className="mt-4 text-ink-700">
              This reset link is incomplete. Open the link from your email again, or{' '}
              <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">request a new one</Link>.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
```

`src/app/(auth)/invite/[token]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import type { InvitationPreview } from '@worktrail/types';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import { publicGet } from '@/lib/public-api';

export const metadata: Metadata = { title: 'Join your team · Work Trail' };

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const result = await publicGet<InvitationPreview>(`/employees/invitations/${encodeURIComponent(token)}`);
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <div className="mx-auto mt-16 max-w-[400px]">
          {result.ok ? (
            <>
              <h1 className="text-[32px] leading-[1.15]">Join {result.data.companyName}</h1>
              <p className="mb-8 mt-1 text-ink-500">
                Set a password for {result.data.email}. You&apos;ll use it to sign in on the Work Trail app.
              </p>
              <AcceptInviteForm token={token} preview={result.data} />
            </>
          ) : (
            <>
              <h1 className="text-[32px] leading-[1.15]">This invite link doesn&apos;t work</h1>
              <p className="mt-3 text-ink-700">
                {result.status === 503
                  ? 'Work Trail is not reachable right now. Try the link again in a moment.'
                  : 'It has expired or was already used. Ask your admin to send you a new invite link.'}
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
```
`src/proxy.ts` needs no change: the matcher is `['/app/:path*', '/login', '/signup']`, so the new public pages aren't gated. Check that by re-reading the `config` export.

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint`
Expected: PASS. Clean.

- [ ] **Step 6: Commit.**
```bash
git add apps/web
git commit -m "feat(web): forgot/reset password and accept-invite pages; employees use the app"
```

---

### Task 9: End-to-end check in the browser

**Files:** none. If a bug is found: write a failing test in the owning task's test file, fix it, and commit as `fix(...)`.

- [ ] **Step 1: Start the stack.**
```bash
pnpm db:up
pnpm --filter @worktrail/api build && (cd apps/api && node scripts/with-env.mjs node dist/main.js) &
pnpm --filter @worktrail/web dev &
```
Expected: `curl -s localhost:4000/api/v1/health` returns `{"status":"ok","db":"up"}`, and `/login` returns 200.

- [ ] **Step 2: Walk the done criterion from `plan.md`: "an admin invites Ravi, Ravi sets a password from the link, and Ravi appears on the dashboard".**
1. Sign in as the demo admin. Go to Employees, then Invite employee. Enter Ravi Kumar, `ravi.test@example.com` and `98765 43210`, then Send invite. Expected: the "Invite sent to Ravi Kumar" panel, and Copy link puts the URL on the clipboard. The API log shows the email, which contains the same link.
2. Go to Employees. Expected: Ravi shows "Invite pending".
3. Open the invite link in a private window. Expected: "Join Demo Field Services Pvt Ltd" with the name pre-filled. Set a password. Expected: the "You're in, Ravi Kumar" panel pointing to the app.
4. Open the same link again. Expected: "This invite link doesn't work".
5. Back in the admin window, refresh Employees. Expected: Ravi shows "Off duty", and the dashboard's Total employees went up by one.
6. Sign in on the web as Ravi. Expected: "This sign-in is for company admins. Employees sign in on the Work Trail app.", and you stay on `/login`.
7. Click "Forgot password?" and request a link for the admin. Copy the link from the API log, open it and set a new password. Expected: "Password saved…". The old password now fails and the new one works.
8. Check the layouts at 1440×900 and 390×844: the employees table drops the ID and email columns on mobile, and the forms keep the auth-card layout.

- [ ] **Step 3: Run the full suite.**
Run: `pnpm test && pnpm --filter @worktrail/web build`
Expected: all workspaces pass, and the build lists `/app/employees`, `/app/employees/new`, `/forgot-password`, `/reset-password` and `/invite/[token]`.

---

## Open Questions (each has a default; tell me if any is wrong)

1. **Email is required to invite** (employees sign in with email + password until mobile OTP). *Default: yes.*
2. **"Create login with a temporary password"** (PRD: "Admin may create an employee account with a temporary password"). *Default: left out of 1b. Invite links cover onboarding. Can be added as a second button later.*
3. **Sending real email.** Phase 1b uses a dev outbox (emails are printed in the API log) because no mail provider key exists yet. Invites still work through Copy link and WhatsApp. *Default: add a real provider (e.g. Resend or Amazon SES) when you share its API key.*
4. **What the employee sees after accepting.** *Default: a "You're in" screen telling them to sign in on the Work Trail app. They get no access to the admin website.* In Phase 2 the same link will open the app directly if it's installed.
5. **Link lifetimes.** *Default: invite 7 days, password reset 1 hour.*
