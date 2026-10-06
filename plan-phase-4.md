# Work Trail Phase 4: Work Updates, Voice Input and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While at work, an employee can send a short work update by typing or speaking. Speech turns into editable text they can correct before sending. Updates sent without signal wait on the phone and upload later, never twice. Employees can see their own past sessions and updates. Admins see the updates, with a category, on the dashboard.

**Architecture:**
- The API gets an `updates` module (`POST /updates`, which ignores repeats of the same update) and `GET /me/history` (the employee's own sessions and updates, read-only).
- `work_updates` gains `client_update_id`, unique per employee, so an update sent twice (for example after a timeout) is stored once, plus `received_at`.
- In the app:
  - An **Add update** screen with a large text box, a microphone button (`expo-speech-recognition`, Android's speech service), optional category chips and a character counter.
  - An **update queue** added to the Phase 3 SQLite database (new table `outbox_updates`), uploaded by the same `syncNow()` after location points.
  - A **History** screen.
- AI summaries are Phase 6: updates are stored with `summaryStatus: QUEUED` and the app shows no summary yet.

**Tech Stack:**
- Phase 3 stack plus `expo-speech-recognition` 57.x, which needs the Phase 3 development build, not Expo Go.
- API: NestJS + Prisma (one migration).
- Web: one small change to the dashboard's Recent updates.

**Spec:**
- `docs/specs/prd.pdf`: §3 "Employee workday" steps 5–7, §4 "Updates and voice input" (all bullets), §5 employee screens (Active work, Add update, Update submitted, History), §9 "Weak network" row.
- `docs/specs/api-contract.pdf`: "Updates and AI" → `POST /updates` (employee only; active session required; returns `summaryStatus: "QUEUED"`).
- `docs/specs/data-model.pdf`: `work_updates`.
- `plan.md` Phase 4 outline, `plan-phase-2.md`, `plan-phase-3.md` (this phase builds on both).

**Assumes Phases 2 and 3 are complete:**
- The mobile app with the auth store and API client.
- `CurrentEmployeeService`.
- The SQLite outbox (`OutboxStorage`, `getOutbox`, `MemoryOutbox`) and `syncNow()`.
- The development build.

---

## What we're building (plain summary)

**For the employee (Android app)**
- **Add update** (button on Home while at work):
  - A large text box, a big **microphone** button ("Tap to speak"), and a language switch: **English** (India) or **हिन्दी**.
  - While they speak, words appear live in grey, then join the text when they pause. They can edit everything before sending.
  - Optional category chips: Site visit, Client meeting, Installation, Service or repair, Delivery, Sales call, Other.
  - A counter shows "120 / 2000". The text needs at least 5 characters.
  - **Send update.** With signal, the app goes back to Home showing "Update sent". Without signal, it shows "Saved. It'll send when you're back online."
- **Not at work?** The Add update button only appears during a work session (the API contract requires an active session). Off duty, Home says "Start work to add updates."
- **Microphone problems are explained:**
  - Permission refused: "Allow the microphone in Settings to speak your update. You can still type it."
  - No speech service on the phone: "Voice typing isn't available on this phone. You can type your update instead."
  - Didn't catch anything: "Didn't catch that. Tap the microphone and try again."
- **History** (link on Home):
  - The last 14 days, grouped by day.
  - Each day shows its work sessions ("9:02 AM – 6:10 PM · 9h 8m") and that day's updates, each with time, category and whether it was spoken.
  - Updates still waiting on the phone are shown with "Waiting to send".

**For the admin (website)**
- Dashboard → **Recent updates** shows the category (for example "Site visit") and a small "Voice" label next to each update. Phase 5 adds the full per-employee Updates tab.

**API**
- `POST /api/v1/updates` (employee only):
  - Request body: `{ clientUpdateId, sessionId, text, inputMethod, category?, submittedAt }`.
  - Returns 201 with `{ update, duplicate: false }`. Repeating the same `clientUpdateId` returns 200 with the stored update and `duplicate: true`.
  - The session must be the employee's own and running. If it has ended, the update is accepted only if it was written during that session (sent from offline). Otherwise 409 "Start work before adding an update."
- `GET /api/v1/me/history?from=YYYY-MM-DD&to=YYYY-MM-DD` (employee only, up to 31 days): own sessions and updates in that range.

**Not in Phase 4:** AI summaries and the "summary ready" state (Phase 6), the admin employee-detail Updates tab (Phase 5), photo or file attachments (not in the MVP).

---

## Files to create and change

### Changed files

| File | What changes |
|---|---|
| `apps/api/prisma/schema.prisma` | `WorkUpdate`: add `clientUpdateId String @map("client_update_id") @db.Uuid`, `receivedAt DateTime @default(now()) @map("received_at") @db.Timestamptz`, and `@@unique([employeeId, clientUpdateId])`. |
| `apps/api/prisma/seed.ts` | Seeded updates get `clientUpdateId: randomUUID()` and a category. |
| `apps/api/src/app.module.ts` | Import `UpdatesModule`. |
| `apps/api/src/modules/me/me.module.ts` | Register `HistoryService`. |
| `apps/api/src/modules/me/controllers/me.controller.ts` | Add `@Roles('EMPLOYEE') @Get('history')`. |
| `apps/api/src/modules/dashboard/services/dashboard.service.ts` | `recentUpdates` also returns `category` and `inputMethod`. |
| `packages/types/src/dashboard.ts` | `recentUpdates` items gain `category: UpdateCategory \| null; inputMethod: 'TYPED' \| 'VOICE'`. |
| `packages/types/src/index.ts` | Export `updates.ts` and `history.ts`. |
| `apps/web/src/components/dashboard/recent-updates.tsx` | Show the category label and a "Voice" tag. |
| `apps/web/test/dashboard.test.tsx` | Fixture gains `category`/`inputMethod`, plus a new assertion. |
| `apps/mobile/app.json` | Add the `expo-speech-recognition` plugin with microphone and speech permission text. |
| `apps/mobile/package.json` | Add the `expo-speech-recognition` dependency. |
| `apps/mobile/src/tracking/outbox.ts` | Add the `UpdateQueueStorage` interface and `QueuedUpdate` type. |
| `apps/mobile/src/tracking/outbox-sqlite.ts` | Add the `outbox_updates` table and implement `UpdateQueueStorage` on the same database. |
| `apps/mobile/src/tracking/store.ts` | Add `getUpdateQueue()` / `setUpdateQueueForTests()`. |
| `apps/mobile/src/tracking/uploader.ts` | Add `flushUpdates()`. `syncNow()` runs points → updates → pending end. |
| `apps/mobile/src/auth/auth-store.ts` | `signOut()` also clears the update queue (after the last sync attempt). |
| `apps/mobile/src/app/(app)/_layout.tsx` | Register the `update` (modal) and `history` routes. |
| `apps/mobile/src/app/(app)/index.tsx` | At work: **Add update** button. Off duty: "Start work to add updates." Header: **History** link. A note for "Update sent" or "Saved…". |
| `apps/mobile/test/setup.ts` | Mock `expo-speech-recognition`. |
| `apps/mobile/test/fakes/memory-outbox.ts` | Add `MemoryUpdateQueue`. |

### New files

```
packages/types/src/updates.ts                   UPDATE_CATEGORIES, labels, CreateUpdateSchema, WorkUpdateDto, CreateUpdateResponse
packages/types/src/history.ts                   HistoryQuerySchema, HistoryResponse
packages/types/test/updates.test.ts

apps/api/prisma/migrations/<ts>_work_update_client_id/migration.sql
apps/api/src/modules/updates/updates.module.ts
apps/api/src/modules/updates/controllers/updates.controller.ts
apps/api/src/modules/updates/services/updates.service.ts
apps/api/src/modules/me/services/history.service.ts
apps/api/test/e2e/updates.e2e-spec.ts
apps/api/test/e2e/history.e2e-spec.ts

apps/mobile/src/updates/update-logic.ts         validate text, choose input method, merge dictated text
apps/mobile/src/updates/use-send-update.ts      online send or queue
apps/mobile/src/updates/use-history.ts          fetch + merge queued updates + group by day
apps/mobile/src/voice/use-dictation.ts          wrapper around expo-speech-recognition
apps/mobile/src/components/Chip.tsx
apps/mobile/src/components/MicButton.tsx
apps/mobile/src/app/(app)/update.tsx            Add update screen
apps/mobile/src/app/(app)/history.tsx           History screen
apps/mobile/test/update-logic.test.ts
apps/mobile/test/use-dictation.test.tsx
apps/mobile/test/update-queue.test.ts
apps/mobile/test/screens/update.test.tsx
apps/mobile/test/screens/history.test.tsx
```

---

## Global Constraints

- Everything in `plan.md`, `plan-phase-2.md` and `plan-phase-3.md` → Global Constraints still applies.
- "Update form has text area, microphone button, category selector (optional), and submit" (PRD §4).
- "Speech recognition fills the same editable text field; employee must be able to correct it before submission" (PRD §4). Spoken text is never sent automatically. Only the **Send update** button sends.
- "Store raw final text, optional transcript metadata, submission timestamp, and session ID" (PRD §4). The text is stored exactly as sent, trimmed. `inputMethod` is `VOICE` if any dictated text was used.
- "Basic validation: 5–2,000 characters after trimming" (PRD §4). The same rule runs in the shared Zod schema, on the API and in the app.
- "POST /updates — Employee only; active session required" (api-contract). There's one exception, for offline: an update written during a session (its `submittedAt` falls inside that session) is accepted after the session ends.
- "Summary generation must not block employee submission" (PRD §4). Updates are stored with `summaryStatus: QUEUED`. No AI call is made in this phase.
- Weak network (PRD §9): local queue, retry with idempotency (`clientUpdateId`), and sync status shown in the UI.
- History is the employee's **own** data only (PRD §2: "An employee must only access their own data").
- Language: speech locale `en-IN` by default, `hi-IN` optional. The chosen language is remembered on the phone.
- Copy is sentence case, plain, and never apologises (plan.md).

## Review Focus

1. **An update is sent and the reply never arrives (timeout), then sent again.**
   - Expected: one stored update. The retry returns the existing one with `duplicate: true`, and the phone drops it from the queue.
   - Tests in Task 2 (API) and Task 5 (queue).
2. **An update is written offline, End work happens, and signal returns later.**
   - Expected: the update is accepted and attached to the session it was written in, with its original time.
   - An update whose time is outside any session of the employee is refused, and the phone stops retrying it.
   - Tests in Task 2 and Task 5.
3. **Speech goes wrong:** microphone permission refused, no speech service on the phone, silence, or network loss mid-sentence.
   - Expected: a clear message, the typed text is kept, and the text box always stays editable.
   - Tests in Task 6.
4. **Text right at the limits:** 4 characters, 2,000 characters, 2,001 characters, only spaces, or 2,000 characters reached while dictating.
   - Expected: the same rules in the app and on the API.
   - Dictation never pushes the text past 2,000. The extra words are dropped and the screen says so.
   - Tests in Task 1 and Task 6.
5. **History across days and timezones.**
   - Expected: a session from 23:30 to 00:30 IST appears on both days with the right minutes.
   - Another employee's data never appears.
   - Updates still on the phone show "Waiting to send" and don't appear twice once sent.
   - Tests in Task 3 and Task 8.

---

### Task 1: Shared types for updates and history

**Files:**
- Create: `packages/types/src/updates.ts`, `packages/types/src/history.ts`, `packages/types/test/updates.test.ts`
- Modify: `packages/types/src/dashboard.ts`, `packages/types/src/index.ts`

**Interfaces:**
- Produces:
  - `UPDATE_CATEGORIES = ['SITE_VISIT','CLIENT_MEETING','INSTALLATION','SERVICE_REPAIR','DELIVERY','SALES_CALL','OTHER'] as const`
  - `UpdateCategory`
  - `UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string>`
  - `UPDATE_MIN = 5`, `UPDATE_MAX = 2000`
  - `UpdateTextSchema`
  - `CreateUpdateSchema` → `CreateUpdateInput { clientUpdateId; sessionId; text; inputMethod: 'TYPED'|'VOICE'; category?: UpdateCategory; submittedAt }`
  - `WorkUpdateDto { id; clientUpdateId; sessionId; text; inputMethod; category: UpdateCategory|null; submittedAt; summaryStatus: 'QUEUED'|'PROCESSING'|'COMPLETE'|'FAILED' }`
  - `CreateUpdateResponse { update: WorkUpdateDto; duplicate: boolean }`
  - `HistoryQuerySchema { from: YYYY-MM-DD; to: YYYY-MM-DD }` (to ≥ from, at most 31 days)
  - `HistoryResponse { timezone; sessions: WorkSessionDto[]; updates: WorkUpdateDto[] }`

- [ ] **Step 1: Write the failing test.** `packages/types/test/updates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CreateUpdateSchema, HistoryQuerySchema, UPDATE_CATEGORY_LABELS } from '../src/index.js';

const base = {
  clientUpdateId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
  sessionId: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f',
  text: 'Visited client site, completed installation.',
  inputMethod: 'VOICE',
  submittedAt: '2026-10-06T06:00:00.000Z',
};

describe('CreateUpdateSchema', () => {
  it('trims the text and accepts an optional category', () => {
    const out = CreateUpdateSchema.parse({ ...base, text: '  Done at site.  ', category: 'SITE_VISIT' });
    expect(out.text).toBe('Done at site.');
    expect(out.category).toBe('SITE_VISIT');
  });

  it.each([
    ['abcd', 'Write at least 5 characters.'],
    ['        ', 'Write at least 5 characters.'],
    ['x'.repeat(2001), 'Keep it under 2,000 characters.'],
  ])('rejects %#', (text, message) => {
    expect(CreateUpdateSchema.safeParse({ ...base, text }).error?.issues[0]?.message).toBe(message);
  });

  it('accepts exactly 2,000 characters', () => {
    expect(CreateUpdateSchema.safeParse({ ...base, text: 'x'.repeat(2000) }).success).toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(CreateUpdateSchema.safeParse({ ...base, category: 'PARTY' }).success).toBe(false);
  });

  it('has a readable label for every category', () => {
    expect(UPDATE_CATEGORY_LABELS.SERVICE_REPAIR).toBe('Service or repair');
  });
});

describe('HistoryQuerySchema', () => {
  it('accepts up to 31 days and rejects reversed or longer ranges', () => {
    expect(HistoryQuerySchema.safeParse({ from: '2026-09-06', to: '2026-10-06' }).success).toBe(true);
    expect(HistoryQuerySchema.safeParse({ from: '2026-10-06', to: '2026-10-01' }).error?.issues[0]?.message).toBe('The end date must be on or after the start date.');
    expect(HistoryQuerySchema.safeParse({ from: '2026-08-01', to: '2026-10-06' }).error?.issues[0]?.message).toBe('Choose at most 31 days.');
  });
});
```
Run `pnpm --filter @worktrail/types test` → FAIL.

- [ ] **Step 2: Implement.** `packages/types/src/updates.ts`:
```ts
import { z } from 'zod';

export const UPDATE_CATEGORIES = [
  'SITE_VISIT',
  'CLIENT_MEETING',
  'INSTALLATION',
  'SERVICE_REPAIR',
  'DELIVERY',
  'SALES_CALL',
  'OTHER',
] as const;
export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];

export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  SITE_VISIT: 'Site visit',
  CLIENT_MEETING: 'Client meeting',
  INSTALLATION: 'Installation',
  SERVICE_REPAIR: 'Service or repair',
  DELIVERY: 'Delivery',
  SALES_CALL: 'Sales call',
  OTHER: 'Other',
};

export const UPDATE_MIN = 5;
export const UPDATE_MAX = 2000;

export const UpdateTextSchema = z
  .string()
  .trim()
  .min(UPDATE_MIN, `Write at least ${UPDATE_MIN} characters.`)
  .max(UPDATE_MAX, 'Keep it under 2,000 characters.');

export const InputMethodSchema = z.enum(['TYPED', 'VOICE']);
export type InputMethod = z.infer<typeof InputMethodSchema>;

export const CreateUpdateSchema = z.object({
  /** Generated on the phone; sending the same id twice stores the update once. */
  clientUpdateId: z.string().uuid(),
  sessionId: z.string().uuid(),
  text: UpdateTextSchema,
  inputMethod: InputMethodSchema,
  category: z.enum(UPDATE_CATEGORIES).optional(),
  /** When the employee tapped Send (phone clock, corrected to server time). */
  submittedAt: z.string().datetime(),
});
export type CreateUpdateInput = z.output<typeof CreateUpdateSchema>;

export type SummaryStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export type WorkUpdateDto = {
  id: string;
  clientUpdateId: string;
  sessionId: string;
  text: string;
  inputMethod: InputMethod;
  category: UpdateCategory | null;
  submittedAt: string;
  summaryStatus: SummaryStatus;
};

export type CreateUpdateResponse = { update: WorkUpdateDto; duplicate: boolean };
```

`packages/types/src/history.ts`:
```ts
import { z } from 'zod';
import type { WorkSessionDto } from './sessions.js';
import type { WorkUpdateDto } from './updates.js';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in the format YYYY-MM-DD.');
const DAY_MS = 86_400_000;

export const HistoryQuerySchema = z
  .object({ from: IsoDate, to: IsoDate })
  .refine((q) => q.to >= q.from, { message: 'The end date must be on or after the start date.', path: ['to'] })
  .refine((q) => (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / DAY_MS < 31, {
    message: 'Choose at most 31 days.',
    path: ['from'],
  });
export type HistoryQuery = z.output<typeof HistoryQuerySchema>;

export type HistoryResponse = {
  timezone: string;
  sessions: WorkSessionDto[];
  updates: WorkUpdateDto[];
};
```
In `dashboard.ts`, add `category: UpdateCategory | null; inputMethod: 'TYPED' | 'VOICE';` to the `recentUpdates` item type (import `UpdateCategory` from `./updates.js`). Append `export * from './updates.js'; export * from './history.js';` to `index.ts`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build` → PASS. The web and API typecheck will now flag the dashboard change, which Task 4 fixes.
- [ ] **Step 4: Commit.** `git commit -m "feat(types): work update, category and history contracts"`

---

### Task 2: `POST /updates` (API)

**Files:**
- Create: migration `work_update_client_id`, `apps/api/src/modules/updates/{updates.module.ts,controllers/updates.controller.ts,services/updates.service.ts}`, `apps/api/test/e2e/updates.e2e-spec.ts`
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `CreateUpdateSchema` and friends (Task 1), `CurrentEmployeeService` (Phase 3), `employeeAs` (Phase 2).
- Produces:
  - `POST /api/v1/updates` → 201 `CreateUpdateResponse`, or 200 with `duplicate: true` for a repeat. Errors:
    - 404 `NOT_FOUND` (not your session)
    - 409 `SESSION_NOT_ACTIVE` (written outside the session)
    - 400 `VALIDATION_FAILED`
    - 403 for admins
  - `toUpdateDto(row): WorkUpdateDto`, exported from the service for reuse by History
  - Window rule: `startedAtServer − 2 min ≤ submittedAt ≤ (endedAtServer ?? now) + 2 min`. The stored `submittedAt` is capped at `now`.

- [ ] **Step 1: Schema and migration.** In `model WorkUpdate` add:
```prisma
  clientUpdateId   String        @map("client_update_id") @db.Uuid
  receivedAt       DateTime      @default(now()) @map("received_at") @db.Timestamptz
```
and `@@unique([employeeId, clientUpdateId])`. Existing rows need a value, so create the migration with `--create-only` and edit it:
```bash
cd apps/api && node scripts/with-env.mjs prisma migrate dev --name work_update_client_id --create-only
```
In the generated SQL, replace the `ADD COLUMN "client_update_id" UUID NOT NULL` line with:
```sql
ALTER TABLE "work_updates" ADD COLUMN "client_update_id" UUID;
UPDATE "work_updates" SET "client_update_id" = gen_random_uuid() WHERE "client_update_id" IS NULL;
ALTER TABLE "work_updates" ALTER COLUMN "client_update_id" SET NOT NULL;
```
(keep the generated `received_at` and unique index statements). Then run `node scripts/with-env.mjs prisma migrate dev && pnpm db:test:migrate && cd ../..`.

In `prisma/seed.ts`, the `workUpdate.create` gets `clientUpdateId: randomUUID()` and `category: CATEGORIES[i % CATEGORIES.length]`, with `const CATEGORIES = ['CLIENT_MEETING', 'INSTALLATION', 'SITE_VISIT', 'SALES_CALL', 'SERVICE_REPAIR'] as const;`. Run `pnpm --filter @worktrail/api db:seed`.

- [ ] **Step 2: Write the failing e2e test.** `apps/api/test/e2e/updates.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('POST /updates', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const send = (token: string, body: object) =>
    http().post('/api/v1/updates').set('Authorization', `Bearer ${token}`).send(body);
  const update = (sessionId: string, over: Record<string, unknown> = {}) => ({
    clientUpdateId: randomUUID(),
    sessionId,
    text: 'Visited client site, completed installation. One sensor needs replacement.',
    inputMethod: 'VOICE',
    category: 'INSTALLATION',
    submittedAt: minutesAgo(1),
    ...over,
  });
  async function atWork() {
    const e = await employeeAs(app, prisma);
    const s = await http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(201);
    await prisma.workSession.update({ where: { id: s.body.session.id }, data: { startedAtServer: new Date(Date.now() - 60 * 60_000) } });
    return { ...e, sessionId: s.body.session.id as string };
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('stores the update as QUEUED for a later summary', async () => {
    const e = await atWork();
    const res = await send(e.token, update(e.sessionId)).expect(201);
    expect(res.body).toMatchObject({
      duplicate: false,
      update: { inputMethod: 'VOICE', category: 'INSTALLATION', summaryStatus: 'QUEUED', sessionId: e.sessionId },
    });
    const row = await prisma.workUpdate.findFirstOrThrow();
    expect(row.text).toBe('Visited client site, completed installation. One sensor needs replacement.');
    expect(row.employeeId).toBe(e.employee.id);
  });

  it('a repeated send stores one update and returns the original', async () => {
    const e = await atWork();
    const body = update(e.sessionId);
    const first = await send(e.token, body).expect(201);
    const again = await send(e.token, body).expect(200);
    expect(again.body).toEqual({ update: first.body.update, duplicate: true });
    expect(await prisma.workUpdate.count()).toBe(1);
  });

  it('accepts an update written during the session but delivered after End work', async () => {
    const e = await atWork();
    const writtenAt = minutesAgo(20);
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    const res = await send(e.token, update(e.sessionId, { submittedAt: writtenAt })).expect(201);
    expect(res.body.update.submittedAt).toBe(writtenAt);
  });

  it('refuses an update written outside the session', async () => {
    const e = await atWork();
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    await prisma.workSession.update({ where: { id: e.sessionId }, data: { endedAtServer: new Date(Date.now() - 30 * 60_000) } });
    const res = await send(e.token, update(e.sessionId, { submittedAt: minutesAgo(1) })).expect(409);
    expect(res.body.error).toMatchObject({ code: 'SESSION_NOT_ACTIVE', message: 'Start work before adding an update.' });
  });

  it('never stores a time in the future', async () => {
    const e = await atWork();
    const res = await send(e.token, update(e.sessionId, { submittedAt: new Date(Date.now() + 60_000).toISOString() })).expect(201);
    expect(Date.parse(res.body.update.submittedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("returns 404 for someone else's session", async () => {
    const a = await atWork();
    const colleague = await employeeAs(app, prisma, a.user.companyId);
    await send(colleague.token, update(a.sessionId)).expect(404);
  });

  it('enforces the 5–2,000 character rule', async () => {
    const e = await atWork();
    const short = await send(e.token, update(e.sessionId, { text: ' hi  ' })).expect(400);
    expect(short.body.error.details.fields.text).toBe('Write at least 5 characters.');
    await send(e.token, update(e.sessionId, { text: 'x'.repeat(2001) })).expect(400);
  });

  it('admins cannot post updates', async () => {
    const admin = await signupAs(app);
    await send(admin.token, update(randomUUID())).expect(403);
  });
});
```
Run → FAIL (404 route).

- [ ] **Step 3: Implement.** `src/modules/updates/services/updates.service.ts`:
```ts
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
```

`src/modules/updates/controllers/updates.controller.ts`:
```ts
import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type CreateUpdateInput, CreateUpdateSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { UpdatesService } from '../services/updates.service.js';

@Roles('EMPLOYEE')
@Controller('updates')
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(CreateUpdateSchema)) body: CreateUpdateInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.updates.create(auth, body);
    res.status(result.duplicate ? 200 : 201);
    return result;
  }
}
```

`src/modules/updates/updates.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { CurrentEmployeeService } from '../sessions/services/current-employee.service.js';
import { UpdatesController } from './controllers/updates.controller.js';
import { UpdatesService } from './services/updates.service.js';

@Module({ controllers: [UpdatesController], providers: [UpdatesService, CurrentEmployeeService] })
export class UpdatesModule {}
```
Import `UpdatesModule` in `app.module.ts`.

- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint` → PASS. Existing dashboard tests that create updates must now pass `clientUpdateId: randomUUID()` (`test/e2e/dashboard.e2e-spec.ts`); update them here.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): idempotent work updates with session window check"`

---

### Task 3: `GET /me/history` (API)

**Files:**
- Create: `apps/api/src/modules/me/services/history.service.ts`, `apps/api/test/e2e/history.e2e-spec.ts`
- Modify: `apps/api/src/modules/me/controllers/me.controller.ts`, `apps/api/src/modules/me/me.module.ts`

**Interfaces:**
- Consumes: `HistoryQuerySchema`, `HistoryResponse`, `dayBounds` (Phase 0–1 `common/utils/time.ts`), `toUpdateDto` (Task 2), `CurrentEmployeeService`.
- Produces: `GET /api/v1/me/history?from&to` (EMPLOYEE) → `HistoryResponse`. It includes every session that **overlaps** the range and every update submitted in it, newest first. Each session's `lastLocationAt` is `null` in history, to keep the query cheap.

- [ ] **Step 1: Write the failing test.** `apps/api/test/e2e/history.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

describe('GET /me/history', () => {
  let app: INestApplication;
  const get = (token: string, q: string) =>
    request(app.getHttpServer()).get(`/api/v1/me/history?${q}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns only my sessions and updates in the range, including overnight sessions', async () => {
    const me = await employeeAs(app, prisma);
    const colleague = await employeeAs(app, prisma, me.user.companyId);
    const d4 = dayBounds('2026-10-04', TZ);
    // 23:30–00:30 IST across 4→5 Oct.
    const overnight = await prisma.workSession.create({
      data: { companyId: me.user.companyId, employeeId: me.employee.id, status: 'COMPLETED',
        startedAtServer: new Date(d4.end.getTime() - 30 * 60_000), endedAtServer: new Date(d4.end.getTime() + 30 * 60_000), totalMinutes: 60 },
    });
    await prisma.workUpdate.create({
      data: { companyId: me.user.companyId, employeeId: me.employee.id, sessionId: overnight.id, clientUpdateId: randomUUID(),
        text: 'Late night repair done.', inputMethod: 'TYPED', submittedAt: new Date(d4.end.getTime() - 10 * 60_000) },
    });
    const theirs = await prisma.workSession.create({
      data: { companyId: me.user.companyId, employeeId: colleague.employee.id, startedAtServer: d4.start, status: 'COMPLETED', endedAtServer: d4.end },
    });

    const res = await get(me.token, 'from=2026-10-05&to=2026-10-05').expect(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual([overnight.id]);
    expect(res.body.updates).toEqual([]); // the update was on the 4th
    const both = await get(me.token, 'from=2026-10-04&to=2026-10-05').expect(200);
    expect(both.body.updates).toHaveLength(1);
    expect(JSON.stringify(both.body)).not.toContain(theirs.id);
  });

  it('rejects a range over 31 days', async () => {
    const me = await employeeAs(app, prisma);
    const res = await get(me.token, 'from=2026-08-01&to=2026-10-06').expect(400);
    expect(res.body.error.details.fields.from).toBe('Choose at most 31 days.');
  });

  it('is for employees only', async () => {
    const admin = await signupAs(app);
    await get(admin.token, 'from=2026-10-01&to=2026-10-06').expect(403);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** Add a `ZodQuery` pipe next to `ZodBody`. `src/common/pipes/zod-query.pipe.ts` re-exports the same class under the new name, so query errors use the same `fields` shape:
```ts
export { ZodBody as ZodQuery } from './zod-body.pipe.js';
```

`src/modules/me/services/history.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { HistoryQuery, HistoryResponse } from '@worktrail/types';
import { dayBounds } from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from '../../sessions/services/current-employee.service.js';
import { toUpdateDto } from '../../updates/services/updates.service.js';

/** The signed-in employee's own sessions and updates for a date range (company timezone). */
@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  async get(auth: AuthContext, q: HistoryQuery): Promise<HistoryResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: employee.companyId } });
    const start = dayBounds(q.from, company.timezone).start;
    const end = dayBounds(q.to, company.timezone).end;

    const [sessions, updates] = await Promise.all([
      this.prisma.workSession.findMany({
        where: {
          employeeId: employee.id,
          startedAtServer: { lt: end },
          OR: [{ endedAtServer: null }, { endedAtServer: { gt: start } }],
        },
        orderBy: { startedAtServer: 'desc' },
      }),
      this.prisma.workUpdate.findMany({
        where: { employeeId: employee.id, submittedAt: { gte: start, lt: end } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    return {
      timezone: company.timezone,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAtServer.toISOString(),
        endedAt: s.endedAtServer?.toISOString() ?? null,
        totalMinutes: s.totalMinutes,
        lastLocationAt: null,
      })),
      updates: updates.map(toUpdateDto),
    };
  }
}
```
In `me.controller.ts`, add (importing `Query`, `Roles`, `HistoryQuerySchema`, `type HistoryQuery` and `ZodQuery`):
```ts
  @Roles('EMPLOYEE')
  @Get('history')
  history(@CurrentAuth() auth: AuthContext, @Query(new ZodQuery(HistoryQuerySchema)) q: HistoryQuery) {
    return this.history.get(auth, q);
  }
```
(inject `private readonly history: HistoryService`). In `me.module.ts`, set `providers: [MeService, HistoryService, CurrentEmployeeService]`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): employee history of own sessions and updates"`

---

### Task 4: Dashboard shows category and voice (API and web)

**Files:**
- Modify: `apps/api/src/modules/dashboard/services/dashboard.service.ts`, `apps/api/test/e2e/dashboard.e2e-spec.ts`, `apps/web/src/components/dashboard/recent-updates.tsx`, `apps/web/test/dashboard.test.tsx`

**Interfaces:**
- Consumes: `DashboardResponse.recentUpdates[].category|inputMethod` (Task 1) and `UPDATE_CATEGORY_LABELS`.

- [ ] **Step 1: Write the failing tests.** In `apps/api/test/e2e/dashboard.e2e-spec.ts`, give the created update `category: 'SITE_VISIT'`, `inputMethod: 'VOICE'` and `clientUpdateId: randomUUID()`, and assert:
```ts
    expect(res.body.recentUpdates[0]).toMatchObject({ category: 'SITE_VISIT', inputMethod: 'VOICE' });
```
In `apps/web/test/dashboard.test.tsx`, add `category: 'SITE_VISIT', inputMethod: 'VOICE'` to the recent-update fixture and add:
```tsx
  it('recent updates show the category and whether the update was spoken', () => {
    render(<RecentUpdates items={data.recentUpdates} timezone="Asia/Kolkata" />);
    expect(screen.getByText('Site visit')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });
```
Run both suites → FAIL.

- [ ] **Step 2: Implement.** In `dashboard.service.ts`, add `category: true, inputMethod: true` to the `recent` query's `select`, and map `category: (u.category as UpdateCategory | null) ?? null, inputMethod: u.inputMethod`.

In `recent-updates.tsx`, under the time line:
```tsx
<p className="flex items-center gap-2 text-xs text-ink-500">
  {timeIn(u.submittedAt, timezone)}
  {u.category ? (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
      {UPDATE_CATEGORY_LABELS[u.category]}
    </span>
  ) : null}
  {u.inputMethod === 'VOICE' ? <span className="rounded-full bg-canvas px-2 py-0.5">Voice</span> : null}
</p>
```
(import `UPDATE_CATEGORY_LABELS` from `@worktrail/types`).

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(dashboard): show update category and voice tag"`

---

### Task 5: On-phone update queue and upload (mobile)

**Files:**
- Modify: `apps/mobile/src/tracking/outbox.ts`, `outbox-sqlite.ts`, `store.ts`, `uploader.ts`, `src/auth/auth-store.ts`, `apps/mobile/test/fakes/memory-outbox.ts`
- Create: `apps/mobile/test/update-queue.test.ts`

**Interfaces:**
- Consumes: `CreateUpdateInput`, `CreateUpdateResponse` (Task 1), `backoffMs` (Phase 3).
- Produces:
  - `QueuedUpdate { clientUpdateId; payload: CreateUpdateInput; attempts; nextAttemptAt }`
  - `UpdateQueueStorage` with methods `add(u)`, `due(now, limit)` (ordered by `payload.submittedAt`), `list()`, `update(u)`, `remove(id)`, `count()`, `clear()`
  - `getUpdateQueue()` / `setUpdateQueueForTests()`
  - `flushUpdates(now?): Promise<{ sent; dropped; pending; stopped }>`
  - `syncNow()` now runs `flushOutbox → flushUpdates → flushPendingEnd`

- [ ] **Step 1: Write the failing test.** `test/update-queue.test.ts`:
```ts
import { setUpdateQueueForTests, setOutboxForTests } from '../src/tracking/store';
import { flushUpdates } from '../src/tracking/uploader';
import { useAuthStore } from '../src/auth/auth-store';
import { MemoryOutbox, MemoryUpdateQueue } from './fakes/memory-outbox';
import type { QueuedUpdate } from '../src/tracking/outbox';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const queued = (id: string, submittedAt: string): QueuedUpdate => ({
  clientUpdateId: id,
  payload: { clientUpdateId: id, sessionId: 's1', text: 'Completed installation at site.', inputMethod: 'TYPED', submittedAt },
  attempts: 0,
  nextAttemptAt: 0,
});

let q: MemoryUpdateQueue;
beforeEach(() => {
  fetchMock.mockReset();
  q = new MemoryUpdateQueue();
  setUpdateQueueForTests(q);
  setOutboxForTests(new MemoryOutbox());
  useAuthStore.setState({ status: 'signedIn', accessToken: 'at' });
});

describe('update queue', () => {
  it('sends queued updates oldest first and removes them, including duplicates', async () => {
    await q.add(queued('b', '2026-10-06T06:05:00Z'));
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    fetchMock
      .mockReturnValueOnce(json({ update: {}, duplicate: false }, 201))
      .mockReturnValueOnce(json({ update: {}, duplicate: true }, 200));
    expect(await flushUpdates()).toMatchObject({ sent: 2, pending: 0, stopped: 'DONE' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).clientUpdateId).toBe('a');
  });

  it('keeps updates and backs off while offline', async () => {
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await flushUpdates(() => 1_000)).toMatchObject({ sent: 0, pending: 1, stopped: 'OFFLINE' });
    expect((await q.list())[0]).toMatchObject({ attempts: 1, nextAttemptAt: 31_000 });
  });

  it('drops an update the server will never accept, and keeps going', async () => {
    await q.add(queued('a', '2026-10-06T06:00:00Z'));
    await q.add(queued('b', '2026-10-06T06:05:00Z'));
    fetchMock
      .mockReturnValueOnce(json({ error: { code: 'SESSION_NOT_ACTIVE', message: 'Start work before adding an update.', details: {} } }, 409))
      .mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    expect(await flushUpdates()).toMatchObject({ sent: 1, dropped: 1, pending: 0 });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.**

`src/tracking/outbox.ts`: append
```ts
import type { CreateUpdateInput } from '@worktrail/types';

export type QueuedUpdate = {
  clientUpdateId: string;
  payload: CreateUpdateInput;
  attempts: number;
  nextAttemptAt: number;
};

/** Work updates written without signal, waiting to be sent. */
export interface UpdateQueueStorage {
  add(u: QueuedUpdate): Promise<void>;
  due(now: number, limit: number): Promise<QueuedUpdate[]>;
  list(): Promise<QueuedUpdate[]>;
  update(u: Pick<QueuedUpdate, 'clientUpdateId' | 'attempts' | 'nextAttemptAt'>): Promise<void>;
  remove(clientUpdateId: string): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}
```
(move the `import` to the top of the file).

`src/tracking/outbox-sqlite.ts`:
- Add to the schema creation:
```sql
CREATE TABLE IF NOT EXISTS outbox_updates (
  client_update_id TEXT PRIMARY KEY NOT NULL,
  submitted_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0
);
```
- Export `openSqliteUpdateQueue(db)`, which implements `UpdateQueueStorage` with:
  - `INSERT OR IGNORE`
  - `SELECT … WHERE next_attempt_at <= ? ORDER BY submitted_at LIMIT ?`
  - `SELECT … ORDER BY submitted_at DESC` for `list()`
  - `UPDATE … SET attempts, next_attempt_at`
  - `DELETE … WHERE client_update_id = ?`
  - `COUNT(*)`
  - `DELETE FROM outbox_updates`

  `payload` is stored as JSON, mirroring the points code.
- Refactor `openSqliteOutbox()` into `openDb()` (shared, opened once) plus the two builders, and make `outbox.clear()` leave `outbox_updates` alone. Each store clears its own table.

`src/tracking/store.ts`: add
```ts
let updates: Promise<UpdateQueueStorage> | null = null;
export function getUpdateQueue(): Promise<UpdateQueueStorage> {
  updates ??= openDb().then(openSqliteUpdateQueue);
  return updates;
}
export function setUpdateQueueForTests(s: UpdateQueueStorage | null) {
  updates = s ? Promise.resolve(s) : null;
}
```

`test/fakes/memory-outbox.ts`: add
```ts
export class MemoryUpdateQueue implements UpdateQueueStorage {
  items = new Map<string, QueuedUpdate>();
  async add(u: QueuedUpdate) { if (!this.items.has(u.clientUpdateId)) this.items.set(u.clientUpdateId, { ...u }); }
  async due(now: number, limit: number) {
    return [...this.items.values()].filter((u) => u.nextAttemptAt <= now)
      .sort((a, b) => a.payload.submittedAt.localeCompare(b.payload.submittedAt)).slice(0, limit);
  }
  async list() { return [...this.items.values()].sort((a, b) => b.payload.submittedAt.localeCompare(a.payload.submittedAt)); }
  async update(u: Pick<QueuedUpdate, 'clientUpdateId' | 'attempts' | 'nextAttemptAt'>) {
    const cur = this.items.get(u.clientUpdateId);
    if (cur) this.items.set(u.clientUpdateId, { ...cur, ...u });
  }
  async remove(id: string) { this.items.delete(id); }
  async count() { return this.items.size; }
  async clear() { this.items.clear(); }
}
```

`src/tracking/uploader.ts`: add
```ts
export async function flushUpdates(now: () => number = Date.now): Promise<FlushResult> {
  const queue = await getUpdateQueue();
  let sent = 0;
  let dropped = 0;
  for (;;) {
    const due = await queue.due(now(), 20);
    if (due.length === 0) break;
    for (const item of due) {
      try {
        await api.request<CreateUpdateResponse>('POST', '/updates', item.payload);
        await queue.remove(item.clientUpdateId);
        sent += 1;
      } catch (e) {
        if (isPermanent(e) || (e instanceof ApiError && e.status === 409)) {
          await queue.remove(item.clientUpdateId);
          dropped += 1;
          continue;
        }
        if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
          return { sent, dropped, pending: await queue.count(), stopped: 'SIGNED_OUT' };
        }
        await queue.update({ clientUpdateId: item.clientUpdateId, attempts: item.attempts + 1, nextAttemptAt: now() + backoffMs(item.attempts + 1) });
        return { sent, dropped, pending: await queue.count(), stopped: 'OFFLINE' };
      }
    }
  }
  return { sent, dropped, pending: await queue.count(), stopped: 'DONE' };
}
```
and in `syncNow()`, call `await flushUpdates();` between `flushOutbox()` and `flushPendingEnd()`. Updates go before the queued end, which keeps the server's view of the session in order.

`src/auth/auth-store.ts` `signOut()`: after the existing `(await getOutbox()).clear()`, add `await (await getUpdateQueue()).clear();`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test` → PASS. The Phase 3 uploader tests still pass. Give them `setUpdateQueueForTests(new MemoryUpdateQueue())` in `beforeEach`.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): durable queue and upload for work updates"`

---

### Task 6: Voice dictation (mobile)

**Files:**
- Create: `apps/mobile/src/voice/use-dictation.ts`, `apps/mobile/src/updates/update-logic.ts`, `apps/mobile/test/use-dictation.test.tsx`, `apps/mobile/test/update-logic.test.ts`
- Modify: `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/test/setup.ts`

**Interfaces:**
- Produces:
  - `appendDictated(current: string, spoken: string, max = 2000): { text: string; truncated: boolean }`
  - `countLabel(text): string` ("120 / 2000")
  - `DictationLocale = 'en-IN'|'hi-IN'`
  - `useDictation({ locale, onFinal })` → `{ state: 'idle'|'listening'|'unavailable'; interim: string; error: string|null; start(); stop() }`

- [ ] **Step 1: Read the bundled docs first.** After installing, read `apps/mobile/node_modules/expo-speech-recognition/README.md`: the event names (`result`, `error`, `end`), `ExpoSpeechRecognitionModule.start` options, `requestPermissionsAsync`, `isRecognitionAvailable`, Android `androidIntentOptions`, and the error codes. If any name differs from the code below, follow the README and ledger a ruling.

- [ ] **Step 2: Install and configure.**
```bash
cd apps/mobile && pnpm expo install expo-speech-recognition && cd ../..
```
Add the plugin to `app.json`:
```json
[
  "expo-speech-recognition",
  {
    "microphonePermission": "Work Trail uses the microphone only while you hold the speak button, to turn your words into update text you can edit.",
    "speechRecognitionPermission": "Work Trail turns your speech into text for your work update.",
    "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
  }
]
```
Rebuild the development build (Phase 3 Task 4 Step 5 order: stop services, `android:dev`).

`test/setup.ts`: append
```ts
jest.mock('expo-speech-recognition', () => require('./mocks/speech'));
```
and create `test/mocks/speech.ts`:
```ts
type Handler = (e: unknown) => void;
const handlers = new Map<string, Handler>();

export const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  isRecognitionAvailable: jest.fn(() => true),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};
export const useSpeechRecognitionEvent = (name: string, handler: Handler) => {
  handlers.set(name, handler);
};
/** Test helper: fire a native speech event. */
export const emitSpeech = (name: string, payload: unknown = {}) => handlers.get(name)?.(payload);
```

- [ ] **Step 3: Write the failing tests.**

`test/update-logic.test.ts`:
```ts
import { appendDictated, countLabel } from '../src/updates/update-logic';

describe('update logic', () => {
  it('appends spoken words with a single space and a capital after a full stop', () => {
    expect(appendDictated('Reached site.', 'checked the panel')).toEqual({ text: 'Reached site. Checked the panel', truncated: false });
    expect(appendDictated('', 'reached site')).toEqual({ text: 'Reached site', truncated: false });
    expect(appendDictated('Reached site ', 'and checked')).toEqual({ text: 'Reached site and checked', truncated: false });
  });

  it('never goes past 2,000 characters and says when words were dropped', () => {
    const r = appendDictated('x'.repeat(1995), 'hello there friend');
    expect(r.text.length).toBe(2000);
    expect(r.truncated).toBe(true);
  });

  it('counts characters after trimming', () => {
    expect(countLabel('  abc  ')).toBe('3 / 2000');
  });
});
```

`test/use-dictation.test.tsx`:
```tsx
import { act, renderHook } from '@testing-library/react-native';
import { useDictation } from '../src/voice/use-dictation';
import { ExpoSpeechRecognitionModule, emitSpeech } from './mocks/speech';

const M = ExpoSpeechRecognitionModule as jest.Mocked<typeof ExpoSpeechRecognitionModule>;

beforeEach(() => jest.clearAllMocks());

describe('useDictation', () => {
  it('starts in the chosen language, shows interim words and hands over final text', async () => {
    const onFinal = jest.fn();
    const { result } = renderHook(() => useDictation({ locale: 'hi-IN', onFinal }));
    await act(() => result.current.start());
    expect(M.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'hi-IN', interimResults: true, continuous: true }));
    expect(result.current.state).toBe('listening');
    act(() => emitSpeech('result', { isFinal: false, results: [{ transcript: 'साइट पर' }] }));
    expect(result.current.interim).toBe('साइट पर');
    act(() => emitSpeech('result', { isFinal: true, results: [{ transcript: 'साइट पर पहुंचा' }] }));
    expect(onFinal).toHaveBeenCalledWith('साइट पर पहुंचा');
    expect(result.current.interim).toBe('');
  });

  it('explains a refused microphone and stays usable for typing', async () => {
    M.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    expect(result.current.error).toBe('Allow the microphone in Settings to speak your update. You can still type it.');
    expect(M.start).not.toHaveBeenCalled();
  });

  it('says when the phone has no speech service', async () => {
    M.isRecognitionAvailable.mockReturnValueOnce(false);
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    expect(result.current.state).toBe('unavailable');
    expect(result.current.error).toBe('Voice typing isn’t available on this phone. You can type your update instead.');
  });

  it('turns "no speech" into a plain retry message', async () => {
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    act(() => emitSpeech('error', { error: 'no-speech', message: '' }));
    expect(result.current.error).toBe('Didn’t catch that. Tap the microphone and try again.');
    expect(result.current.state).toBe('idle');
  });

  it('stop ends listening', async () => {
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    act(() => result.current.stop());
    act(() => emitSpeech('end'));
    expect(M.stop).toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });
});
```
Run → FAIL.

- [ ] **Step 4: Implement.**

`src/updates/update-logic.ts`:
```ts
import { UPDATE_MAX } from '@worktrail/types';

/** Adds dictated words to what's already typed, tidily, without passing the length limit. */
export function appendDictated(current: string, spoken: string, max = UPDATE_MAX): { text: string; truncated: boolean } {
  const words = spoken.trim();
  if (!words) return { text: current, truncated: false };
  const base = current.replace(/\s+$/, '');
  const startsSentence = base === '' || /[.!?।]$/.test(base);
  const piece = startsSentence ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  const joined = base ? `${base} ${piece}` : piece;
  return joined.length > max ? { text: joined.slice(0, max), truncated: true } : { text: joined, truncated: false };
}

export const countLabel = (text: string) => `${text.trim().length} / ${UPDATE_MAX}`;
```

`src/voice/use-dictation.ts`:
```ts
import { useCallback, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export type DictationLocale = 'en-IN' | 'hi-IN';
type State = 'idle' | 'listening' | 'unavailable';

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Allow the microphone in Settings to speak your update. You can still type it.',
  'no-speech': 'Didn’t catch that. Tap the microphone and try again.',
  'speech-timeout': 'Didn’t catch that. Tap the microphone and try again.',
  network: 'Voice typing needs a connection right now. You can type your update instead.',
  'service-not-allowed': 'Voice typing isn’t available on this phone. You can type your update instead.',
  'language-not-supported': 'This language isn’t available for voice typing on your phone. Try English, or type it.',
};
const UNAVAILABLE = MESSAGES['service-not-allowed']!;
const FALLBACK = 'Voice typing stopped. Tap the microphone to try again.';

/** Speech → text for the update box. Text is handed over only when a phrase is final. */
export function useDictation({ locale, onFinal }: { locale: DictationLocale; onFinal: (text: string) => void }) {
  const [state, setState] = useState<State>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useSpeechRecognitionEvent('result', (e: { isFinal: boolean; results: Array<{ transcript: string }> }) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      setInterim('');
      if (text.trim()) onFinalRef.current(text);
    } else {
      setInterim(text);
    }
  });
  useSpeechRecognitionEvent('error', (e: { error: string }) => {
    setError(MESSAGES[e.error] ?? FALLBACK);
    setInterim('');
    setState('idle');
  });
  useSpeechRecognitionEvent('end', () => {
    setInterim('');
    setState((s) => (s === 'unavailable' ? s : 'idle'));
  });

  const start = useCallback(async () => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('unavailable');
      setError(UNAVAILABLE);
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError(MESSAGES['not-allowed']!);
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: locale, interimResults: true, continuous: true, addsPunctuation: true });
    setState('listening');
  }, [locale]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { state, interim, error, start, stop };
}
```

- [ ] **Step 5: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(mobile): voice dictation in English (India) and Hindi"`

---

### Task 7: Add update screen and Home entry point (mobile)

**Files:**
- Create: `apps/mobile/src/updates/use-send-update.ts`, `apps/mobile/src/components/Chip.tsx`, `apps/mobile/src/components/MicButton.tsx`, `apps/mobile/src/app/(app)/update.tsx`, `apps/mobile/test/screens/update.test.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/test/screens/home.test.tsx`

**Interfaces:**
- Consumes: `useWorkSession` (session + `offsetMs`), `useDictation`, `appendDictated`, `CreateUpdateSchema`, `UPDATE_CATEGORIES`/labels, `getUpdateQueue`, `syncNow`, `api`, `ApiError`, `randomUUID` (expo-crypto), `getOutbox` meta (remember the language).
- Produces:
  - `useSendUpdate() → { send(input: { text; inputMethod; category? }): Promise<'sent'|'queued'> ; sending }`
  - Route `/(app)/update` (modal)
  - Home param `?note=sent|queued` that shows the matching notice

- [ ] **Step 1: Write the failing test.** `test/screens/update.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UpdateScreen from '../../src/app/(app)/update';
import { mockRouter } from '../mocks/expo-router';
import { emitSpeech } from '../mocks/speech';
import { setOutboxForTests, setUpdateQueueForTests } from '../../src/tracking/store';
import { ACTIVE_SESSION_KEY } from '../../src/sessions/use-work-session';
import { MemoryOutbox, MemoryUpdateQueue } from '../fakes/memory-outbox';

jest.mock('../../src/tracking/uploader', () => ({ syncNow: jest.fn(async () => undefined) }));
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

let queue: MemoryUpdateQueue;
function renderScreen() {
  const qc = new QueryClient();
  qc.setQueryData(ACTIVE_SESSION_KEY, {
    session: { id: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f', status: 'ACTIVE', startedAt: new Date().toISOString(), endedAt: null, totalMinutes: null, lastLocationAt: null },
    offsetMs: 0,
  });
  return render(<QueryClientProvider client={qc}><UpdateScreen /></QueryClientProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  mockRouter.replace.mockReset();
  queue = new MemoryUpdateQueue();
  setUpdateQueueForTests(queue);
  setOutboxForTests(new MemoryOutbox());
});

describe('Add update', () => {
  it('needs at least 5 characters before sending', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'ok');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    expect(await screen.findByText('Write at least 5 characters.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a typed update with a category and goes back home', async () => {
    fetchMock.mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Completed installation at Sai Kripa Clinic.');
    fireEvent.press(screen.getByRole('button', { name: 'Installation' }));
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/?note=sent'));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ inputMethod: 'TYPED', category: 'INSTALLATION', text: 'Completed installation at Sai Kripa Clinic.' });
  });

  it('marks the update as VOICE when dictated text was used, and keeps it editable', async () => {
    fetchMock.mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Speak your update' }));
    await waitFor(() => emitSpeech('result', { isFinal: true, results: [{ transcript: 'reached the warehouse and checked stock' }] }));
    expect(screen.getByLabelText('Your update').props.value).toBe('Reached the warehouse and checked stock');
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Reached the Andheri warehouse and checked stock');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ inputMethod: 'VOICE', text: 'Reached the Andheri warehouse and checked stock' });
  });

  it('with no signal, saves the update on the phone and says so', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Follow-up call with Mehta Hardware done.');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/?note=queued'));
    expect(await queue.count()).toBe(1);
  });

  it('shows the character count', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Hello there');
    expect(screen.getByText('11 / 2000')).toBeOnTheScreen();
  });
});
```
In `test/screens/home.test.tsx`, add:
```tsx
  it('at work: offers Add update; off duty: explains it needs a session', async () => {
    fetchMock.mockReturnValueOnce(json({ session: session(new Date().toISOString()), serverTime: new Date().toISOString() }));
    const { unmount } = renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Add update' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/update');
    unmount();
    fetchMock.mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }));
    renderHome();
    expect(await screen.findByText('Start work to add updates.')).toBeOnTheScreen();
  });
```
Run → FAIL.

- [ ] **Step 2: Implement.**

`src/updates/use-send-update.ts`:
```ts
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import type { CreateUpdateInput, CreateUpdateResponse, InputMethod, UpdateCategory } from '@worktrail/types';
import { api, ApiError } from '../api';
import { ACTIVE_SESSION_KEY } from '../sessions/use-work-session';
import { getUpdateQueue } from '../tracking/store';
import { syncNow } from '../tracking/uploader';

type ActiveView = { session: { id: string } | null; offsetMs: number };

/** Sends an update now, or keeps it on the phone when there's no signal. */
export function useSendUpdate() {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  async function send(input: { text: string; inputMethod: InputMethod; category?: UpdateCategory }): Promise<'sent' | 'queued'> {
    const active = qc.getQueryData<ActiveView>(ACTIVE_SESSION_KEY);
    if (!active?.session) throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Start work before adding an update.');
    const payload: CreateUpdateInput = {
      clientUpdateId: randomUUID(),
      sessionId: active.session.id,
      text: input.text.trim(),
      inputMethod: input.inputMethod,
      category: input.category,
      submittedAt: new Date(Date.now() + active.offsetMs).toISOString(),
    };
    setSending(true);
    try {
      await api.request<CreateUpdateResponse>('POST', '/updates', payload);
      await qc.invalidateQueries({ queryKey: ['history'] });
      return 'sent';
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NETWORK') {
        await (await getUpdateQueue()).add({ clientUpdateId: payload.clientUpdateId, payload, attempts: 1, nextAttemptAt: 0 });
        void syncNow().catch(() => undefined);
        return 'queued';
      }
      throw e;
    } finally {
      setSending(false);
    }
  }

  return { send, sending };
}
```

`src/components/Chip.tsx`:
```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/theme';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      <Text style={[styles.text, { color: selected ? colors.brand700 : colors.ink700 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  on: { backgroundColor: colors.brand100, borderColor: colors.brand200 },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
  text: { fontFamily: fonts.medium, fontSize: 15 },
});
```

`src/components/MicButton.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

/** Big round microphone button: orange when idle, solid red-orange ring while listening. */
export function MicButton({ listening, disabled, onPress }: { listening: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Speak your update'}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.button, listening && styles.listening, disabled && styles.disabled]}
      >
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Rect x={9} y={3} width={6} height={12} rx={3} fill="#fff" />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Text style={styles.label}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  button: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand500, alignItems: 'center', justifyContent: 'center' },
  listening: { borderWidth: 6, borderColor: colors.brand200, backgroundColor: '#E84A00' },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink500 },
});
```

`src/app/(app)/update.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UPDATE_CATEGORIES, UPDATE_CATEGORY_LABELS, UpdateTextSchema, type UpdateCategory } from '@worktrail/types';
import { ApiError } from '../../api';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { MicButton } from '../../components/MicButton';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { getOutbox } from '../../tracking/store';
import { appendDictated, countLabel } from '../../updates/update-logic';
import { useSendUpdate } from '../../updates/use-send-update';
import { useDictation, type DictationLocale } from '../../voice/use-dictation';
import { colors, fonts, radius } from '../../theme/theme';

export default function UpdateScreen() {
  const router = useRouter();
  const { send, sending } = useSendUpdate();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<UpdateCategory | undefined>();
  const [usedVoice, setUsedVoice] = useState(false);
  const [locale, setLocale] = useState<DictationLocale>('en-IN');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getOutbox().then((b) => b.getMeta('dictationLocale' as never)).then((v) => {
      if (v === 'hi-IN' || v === 'en-IN') setLocale(v);
    });
  }, []);

  const dictation = useDictation({
    locale,
    onFinal: (spoken) => {
      setUsedVoice(true);
      setText((cur) => {
        const r = appendDictated(cur, spoken);
        if (r.truncated) setNote('You’ve reached 2,000 characters, so the last words weren’t added.');
        return r.text;
      });
    },
  });

  const chooseLocale = (l: DictationLocale) => {
    setLocale(l);
    void getOutbox().then((b) => b.setMeta('dictationLocale' as never, l));
  };

  const submit = async () => {
    if (dictation.state === 'listening') dictation.stop();
    const parsed = UpdateTextSchema.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    try {
      const result = await send({ text: parsed.data, inputMethod: usedVoice ? 'VOICE' : 'TYPED', category });
      router.replace(`/?note=${result}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>Cancel</Text>
      <Text style={styles.title}>Add update</Text>
      <View style={styles.langRow}>
        <Chip label="English" selected={locale === 'en-IN'} onPress={() => chooseLocale('en-IN')} />
        <Chip label="हिन्दी" selected={locale === 'hi-IN'} onPress={() => chooseLocale('hi-IN')} />
      </View>
      <MicButton
        listening={dictation.state === 'listening'}
        disabled={dictation.state === 'unavailable'}
        onPress={() => (dictation.state === 'listening' ? dictation.stop() : void dictation.start())}
      />
      {dictation.interim ? <Text style={styles.interim}>{dictation.interim}</Text> : null}
      {dictation.error ? <Notice tone="warning">{dictation.error}</Notice> : null}
      <TextInput
        accessibilityLabel="Your update"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="What did you do? For example: Completed installation at the client site. One sensor needs replacement."
        placeholderTextColor={colors.ink300}
        style={[styles.box, error ? styles.boxError : null]}
        textAlignVertical="top"
      />
      <View style={styles.metaRow}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <View />}
        <Text style={styles.count}>{countLabel(text)}</Text>
      </View>
      {note ? <Notice>{note}</Notice> : null}
      <Text style={styles.label}>Category (optional)</Text>
      <View style={styles.chips}>
        {UPDATE_CATEGORIES.map((c) => (
          <Chip key={c} label={UPDATE_CATEGORY_LABELS[c]} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
        ))}
      </View>
      <Button title="Send update" loading={sending} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  langRow: { flexDirection: 'row', gap: 8, alignSelf: 'center' },
  interim: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500, fontStyle: 'italic', textAlign: 'center' },
  box: { minHeight: 160, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14, fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink900 },
  boxError: { borderColor: colors.danger500 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.danger500 },
  count: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
```
Add `'dictationLocale'` to the `MetaKey` union in `src/tracking/outbox.ts`, so the two `as never` casts above become unnecessary. Remove the casts once you've added it.

`src/app/(app)/_layout.tsx`: add `<Stack.Screen name="update" options={{ presentation: 'modal' }} />` and `<Stack.Screen name="history" />`.

`src/app/(app)/index.tsx`:
- In the at-work card, add `<Button title="Add update" variant="secondary" onPress={() => router.push('/update')} />` under **End work**.
- In the off-duty card, add `<Text style={styles.body}>Start work to add updates.</Text>`.
- In the header, add a **History** text link before **Profile** (`router.push('/history')`).
- Read `const { note } = useLocalSearchParams<{ note?: string }>()` and render:
```tsx
{note === 'sent' ? <Notice>Update sent.</Notice> : null}
{note === 'queued' ? <Notice>Saved. It’ll send when you’re back online.</Notice> : null}
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): add update screen with voice, categories and offline save"`

---

### Task 8: History screen (mobile)

**Files:**
- Create: `apps/mobile/src/updates/use-history.ts`, `apps/mobile/src/app/(app)/history.tsx`, `apps/mobile/test/screens/history.test.tsx`

**Interfaces:**
- Consumes: `HistoryResponse`, `getUpdateQueue().list()`, `timeLabel` (Phase 2), `formatInTimeZone`.
- Produces:
  - `groupHistory(h: HistoryResponse, queued: QueuedUpdate[], days: string[]): HistoryDay[]`
  - `HistoryDay { date; label; sessions: Array<WorkSessionDto & { minutesThatDay: number }>; updates: Array<WorkUpdateDto & { waiting: boolean }> }`
  - `useHistory(days = 14)`

- [ ] **Step 1: Write the failing test.** `test/screens/history.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoryScreen from '../../src/app/(app)/history';
import { groupHistory } from '../../src/updates/use-history';
import { setUpdateQueueForTests } from '../../src/tracking/store';
import { MemoryUpdateQueue } from '../fakes/memory-outbox';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const TZ = 'Asia/Kolkata';

const history = {
  timezone: TZ,
  sessions: [
    { id: 's2', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null },
    { id: 's1', status: 'COMPLETED', startedAt: '2026-10-04T18:00:00.000Z', endedAt: '2026-10-04T19:00:00.000Z', totalMinutes: 60, lastLocationAt: null },
  ],
  updates: [
    { id: 'u1', clientUpdateId: 'c1', sessionId: 's2', text: 'Completed installation.', inputMethod: 'VOICE', category: 'INSTALLATION', submittedAt: '2026-10-05T06:00:00.000Z', summaryStatus: 'QUEUED' },
  ],
};

describe('history', () => {
  it('splits an overnight session across both days with the right minutes', () => {
    const days = groupHistory(history as never, [], ['2026-10-05', '2026-10-04']);
    expect(days[0]!.sessions.find((s) => s.id === 's1')?.minutesThatDay).toBe(30);
    expect(days[1]!.sessions.find((s) => s.id === 's1')?.minutesThatDay).toBe(30);
  });

  it('shows queued updates as waiting, and never twice once sent', () => {
    const queued = [
      { clientUpdateId: 'c9', payload: { clientUpdateId: 'c9', sessionId: 's2', text: 'Offline note.', inputMethod: 'TYPED', submittedAt: '2026-10-05T07:00:00.000Z' }, attempts: 1, nextAttemptAt: 0 },
      { clientUpdateId: 'c1', payload: { clientUpdateId: 'c1', sessionId: 's2', text: 'Completed installation.', inputMethod: 'VOICE', submittedAt: '2026-10-05T06:00:00.000Z' }, attempts: 1, nextAttemptAt: 0 },
    ];
    const day = groupHistory(history as never, queued as never, ['2026-10-05'])[0]!;
    expect(day.updates.map((u) => [u.clientUpdateId, u.waiting])).toEqual([['c9', true], ['c1', false]]);
  });

  it('renders days with sessions and updates', async () => {
    setUpdateQueueForTests(new MemoryUpdateQueue());
    fetchMock.mockResolvedValue(new Response(JSON.stringify(history)));
    render(<QueryClientProvider client={new QueryClient()}><HistoryScreen /></QueryClientProvider>);
    expect(await screen.findByText('9:02 AM – 6:10 PM · 9h 8m')).toBeOnTheScreen();
    const update = screen.getByText('Completed installation.');
    expect(update).toBeOnTheScreen();
    expect(screen.getByText(/Installation · Spoken/)).toBeOnTheScreen();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `src/updates/use-history.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import type { HistoryResponse, WorkSessionDto, WorkUpdateDto } from '@worktrail/types';
import { api } from '../api';
import type { QueuedUpdate } from '../tracking/outbox';
import { getUpdateQueue } from '../tracking/store';

export type HistoryDay = {
  date: string;
  label: string;
  sessions: Array<WorkSessionDto & { minutesThatDay: number }>;
  updates: Array<WorkUpdateDto & { waiting: boolean }>;
};

const dayStart = (date: string, tz: string) => Date.parse(formatInTimeZone(new Date(`${date}T12:00:00Z`), tz, "yyyy-MM-dd'T'00:00:00XXX"));

export function groupHistory(h: HistoryResponse, queued: QueuedUpdate[], days: string[]): HistoryDay[] {
  const sentIds = new Set(h.updates.map((u) => u.clientUpdateId));
  const waiting: Array<WorkUpdateDto & { waiting: boolean }> = queued
    .filter((q) => !sentIds.has(q.clientUpdateId))
    .map((q) => ({
      id: q.clientUpdateId, clientUpdateId: q.clientUpdateId, sessionId: q.payload.sessionId, text: q.payload.text,
      inputMethod: q.payload.inputMethod, category: q.payload.category ?? null, submittedAt: q.payload.submittedAt,
      summaryStatus: 'QUEUED', waiting: true,
    }));
  const allUpdates = [...waiting, ...h.updates.map((u) => ({ ...u, waiting: false }))]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return days.map((date) => {
    const from = dayStart(date, h.timezone);
    const to = from + 86_400_000;
    const now = Date.now();
    const sessions = h.sessions
      .map((s) => {
        const a = Math.max(Date.parse(s.startedAt), from);
        const b = Math.min(s.endedAt ? Date.parse(s.endedAt) : now, to);
        return { ...s, minutesThatDay: Math.max(0, Math.round((b - a) / 60_000)) };
      })
      .filter((s) => s.minutesThatDay > 0 || (Date.parse(s.startedAt) >= from && Date.parse(s.startedAt) < to));
    const updates = allUpdates.filter((u) => {
      const t = Date.parse(u.submittedAt);
      return t >= from && t < to;
    });
    const label = formatInTimeZone(new Date(from), h.timezone, 'EEE d MMM');
    return { date, label, sessions, updates };
  });
}

/** Last `days` days of my sessions and updates, newest day first, including updates still on the phone. */
export function useHistory(days = 14) {
  return useQuery({
    queryKey: ['history', days],
    queryFn: async () => {
      const today = new Date();
      const dates = Array.from({ length: days }, (_, i) => formatInTimeZone(new Date(today.getTime() - i * 86_400_000), 'Asia/Kolkata', 'yyyy-MM-dd'));
      const h = await api.request<HistoryResponse>('GET', `/me/history?from=${dates.at(-1)}&to=${dates[0]}`);
      const queued = await (await getUpdateQueue()).list();
      return groupHistory(h, queued, dates).filter((d) => d.sessions.length || d.updates.length);
    },
  });
}
```

`src/app/(app)/history.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UPDATE_CATEGORY_LABELS } from '@worktrail/types';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { timeLabel } from '../../sessions/session-logic';
import { useHistory } from '../../updates/use-history';
import { colors, fonts, radius, shadow } from '../../theme/theme';

const TZ = 'Asia/Kolkata';
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function HistoryScreen() {
  const router = useRouter();
  const history = useHistory(14);

  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>Back</Text>
      <Text style={styles.title}>History</Text>
      <Text style={styles.sub}>Your last 14 days of work.</Text>
      {history.error ? <Notice tone="warning">{(history.error as Error).message}</Notice> : null}
      {history.data && history.data.length === 0 ? (
        <Notice>Nothing yet. Your work sessions and updates will appear here after you start work.</Notice>
      ) : null}
      {history.data?.map((day) => (
        <View key={day.date} style={[styles.card, shadow]}>
          <Text style={styles.day}>{day.label}</Text>
          {day.sessions.map((s) => (
            <Text key={s.id} style={styles.session}>
              {timeLabel(s.startedAt, TZ)} – {s.endedAt ? timeLabel(s.endedAt, TZ) : 'now'} · {duration(s.minutesThatDay)}
            </Text>
          ))}
          {day.updates.map((u) => (
            <View key={u.clientUpdateId} style={styles.update}>
              <Text style={styles.meta}>
                {[timeLabel(u.submittedAt, TZ), u.category ? UPDATE_CATEGORY_LABELS[u.category] : null, u.inputMethod === 'VOICE' ? 'Spoken' : null, u.waiting ? 'Waiting to send' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.text}>{u.text}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, gap: 10 },
  day: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink900 },
  session: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink700 },
  update: { gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink900 },
});
```
The `Installation · Spoken` check in the test is a regex, so the leading time doesn't need to match. The Phase 2 hardcoded `TZ` follows the same rule as Home: once `useMe()` is loaded, use `me.data?.company.timezone ?? 'Asia/Kolkata'`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): history of my sessions and updates"`

---

### Task 9: Check on a real phone and the dashboard

**Files:** none. If something breaks: write a failing test in the owning task's file, fix it, and commit as `fix(...)`.

- [ ] **Step 1: Build and run** (memory-safe order: build the development build first with the servers stopped, then run `pnpm db:up`, start the API from `dist`, re-seed, and start the website with `next start`).
- [ ] **Step 2: Walk through the flows** on the phone as `amit@demo.worktrail.in`, and add a section "Phase 4: updates and voice" with these results to `docs/device-test-android.md`:
  1. Off duty → Home says "Start work to add updates." Start work → **Add update** appears.
  2. Type an update with the "Site visit" category → **Send update** → Home shows "Update sent." On the website, the dashboard's Recent updates shows it with "Site visit".
  3. Speak in English: tap the mic, say "reached the client site and checked the panel", tap to stop. Expected: grey words while talking, then editable text. Edit one word and send. The dashboard shows a "Voice" tag.
  4. Switch to **हिन्दी** and speak a sentence. Expected: Devanagari text. Close and reopen the screen. Expected: Hindi is still selected.
  5. Deny the microphone (Android Settings → Apps → Work Trail → Permissions). Expected: the plain message, and typing still works.
  6. Airplane mode: send an update. Expected: "Saved. It'll send when you're back online." and History shows "Waiting to send". End work, then turn airplane mode off. Expected: the update arrives once, attached to the session, with its original time.
  7. History lists today with the session times and both updates, plus earlier seeded days.
  8. Type 1,990 characters, then dictate a long sentence. Expected: the text stops at 2,000 and the "last words weren't added" note appears.
- [ ] **Step 3: Run the full suite.** `pnpm test` → every workspace passes. Then `docker compose exec -T postgres psql -U worktrail -c "select count(*) - count(distinct (employee_id, client_update_id)) as duplicates from work_updates;"` → `0`. Commit the updated device-test doc.

---

## Open Questions (each has a default; tell me if any is wrong)

1. **Speech languages.** *Default: English (India) and Hindi, with Hindi saved as Devanagari text.* Add Marathi (`mr-IN`), Tamil (`ta-IN`), Telugu or others? It's a one-line change per language if the phone's speech service supports it.
2. **Categories.** *Default: Site visit, Client meeting, Installation, Service or repair, Delivery, Sales call, Other (optional).* Do you want your own list, or should each company set its own later?
3. **Updates only during work.** *Default: Add update appears only while at work (the API contract requires an active session).* Should employees be able to add a note after End work about that day?
4. **Spoken audio.** *Default: audio is never stored or uploaded. Only the text is kept.* Keeping recordings would raise storage costs and privacy questions.
5. **Editing or deleting sent updates.** *Default: not possible in the MVP. The admin sees exactly what was sent (PRD: "Preserve raw updates").* Should employees be able to delete an update within, say, 5 minutes?
6. **History length on the phone.** *Default: the last 14 days.* Is 7 or 30 days better for your teams?
