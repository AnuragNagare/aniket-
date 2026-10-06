# Work Trail Phase 3: Background Location Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While an employee is at work, the Android app records their location about every 5 minutes, even with the screen off or the app closed, and shows a visible notification while it does. Points are saved on the phone first and uploaded when there's signal, with no duplicates and nothing lost. End work stops tracking straight away, and it works without signal too.

**Architecture:**
- A background task (`expo-task-manager`) runs `expo-location` with an Android foreground service, which shows the persistent "you're at work" notification.
- Every location goes into an on-phone queue in SQLite (`expo-sqlite`) with its `clientPointId`.
- An uploader sends queued points in batches of 50 to a new `POST /api/v1/locations/batch` endpoint. It retries with backoff. The server stores each `(employee, clientPointId)` only once, so retries can't create duplicates.
- The uploader runs after each background delivery, when the app opens and when signal returns. A shared lock means only one upload runs at a time.
- End work stops tracking first. If the phone is offline, the end request is queued with its real end time and sent later.
- On every launch, tracking is compared with the server and restarted or stopped to match, which covers the app being killed or the phone rebooting.

**Tech Stack:**
- Phase 2 stack, plus `expo-task-manager`, `expo-sqlite`, `@react-native-community/netinfo`, `expo-intent-launcher` and `expo-build-properties`.
- This is the first phase that needs a **development build** (an installable app). Expo Go can't do background location.
- Builds use the Android SDK already installed in `%LOCALAPPDATA%\Android\Sdk`. EAS (Expo's cloud build service) is an optional alternative.

**Spec:**
- `docs/specs/prd.pdf` §3 "Employee workday" step 4, §4 "Location capture" (every bullet), §7 privacy, §9 risks (background limits, battery drain, weak network).
- `docs/specs/api-contract.pdf` "Location" → `POST /locations/batch` (Idempotency-Key header).
- `docs/specs/data-model.pdf` `location_points` (`client_point_id` unique with employee; `source`; `quality_flag`).
- `docs/specs/plan.pdf` Phase 3 ("Done when: location points survive temporary offline connectivity and appear in the database without duplicates").
- `plan-phase-2.md` (everything this phase builds on).

**Assumes Phase 2 is complete:** `apps/mobile` exists with its auth store, API client, `location.ts`, `use-work-session.ts`, and the sessions and `/me` API.

---

## What we're building (plain summary)

**For the employee**
- **Background tracking.** When they tap **Start work**, Android shows a notification: "Work Trail: you're at work. Your location is shared every 5 minutes until you tap End work." Location is recorded about every 5 minutes with the screen off or the app closed. It stops the moment they tap **End work**.
- **A second permission step.** After the existing location screen, a plain explanation asks them to choose **"Allow all the time"**. If they decline, work sessions still work, and the app clearly says that only the start and end locations are recorded, with a "Turn it on" link.
- **A status line on Home**, showing one of:
  - "Location shared every 5 minutes · last sent 10:24 AM"
  - "3 locations waiting to send. They'll go when you're back online."
  - "Background location is off…"
- **No signal is fine.** Points wait on the phone. **End work** with no signal still ends work at the moment they tapped it, and the app says "We'll send it when you're back online."
- **Battery tip.** Many phones sold in India (Xiaomi, Oppo, Vivo, Realme, Samsung) stop background apps to save battery. The first time tracking starts, the app shows a one-time tip with an **Open battery settings** button.
- **Reopening fixes things.** If the phone killed the app or rebooted during work, opening the app resumes tracking automatically.

**For the admin (no website changes needed)**
- The dashboard's "Last known locations" pins and "last seen" times update every few minutes during work, because they already read `location_points`.

**API**
- `POST /api/v1/locations/batch`: 1–100 points for one of the employee's own sessions.
  - Requires the `Idempotency-Key` header.
  - Points the server already has are counted as duplicates and skipped.
  - Points captured outside the session's time window are returned as `rejected`, not stored.
  - Points arriving after End work are still accepted if they were captured during the session, so nothing collected offline is lost.
- `POST /sessions/:id/end` gains an optional `endedAt` (the phone's best estimate of server time when End was tapped). The server keeps it only if it falls between the session start and now. Otherwise it uses its own clock.

**Not in Phase 3:** the route line, data-gap display and point inspection on the admin map (Phase 5), work updates (Phase 4), the Play Store listing and its background-location declaration (Phase 7), iOS.

---

## Files to create and change

### Changed files (all from Phase 2 unless noted)

| File | What changes |
|---|---|
| `packages/types/src/sessions.ts` | `EndSessionSchema` gains optional `endedAt: z.string().datetime()` (estimated server time of the End tap). |
| `packages/types/src/index.ts` | Export the new `locations.ts`. |
| `apps/api/src/modules/sessions/services/sessions.service.ts` | Use the new `CurrentEmployeeService` instead of its private `employeeFor`. `end()` uses `input.endedAt`, kept between start and now, for `endedAtServer` and `totalMinutes`. |
| `apps/api/src/modules/sessions/sessions.module.ts` | Register `LocationsController`, `LocationsService` and `CurrentEmployeeService`. |
| `apps/mobile/app.json` | Turn on background location and the foreground service in the `expo-location` plugin config. Add Android permissions `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`. Add the `expo-build-properties` plugin (cleartext HTTP to the dev API only), `expo-sqlite`, and the background permission text. |
| `apps/mobile/package.json` | New dependencies. Scripts `android:dev` (`expo run:android`) and `android:apk` (local release APK). |
| `apps/mobile/src/api/client.ts` | `request()` accepts `opts.headers` (needed for `Idempotency-Key`). |
| `apps/mobile/src/location/location.ts` | Add `getBackgroundPermission()` and `requestBackgroundPermission()`. |
| `apps/mobile/src/sessions/use-work-session.ts` | Start: begin background tracking after the server confirms. End: stop tracking first, send `endedAt`, and queue the end if offline. `fetchActive()` syncs tracking with the server and respects a queued end. |
| `apps/mobile/src/auth/auth-store.ts` | `signOut()` stops tracking, tries one last upload, then wipes the on-phone queue (privacy: the next person who signs in never inherits it). |
| `apps/mobile/src/app/_layout.tsx` | Import the background task module at the top (Android requires the task to be defined before the app renders). |
| `apps/mobile/src/app/(app)/_layout.tsx` | Mount `useSyncTriggers()`: upload when the app comes to the foreground and when the connection returns. |
| `apps/mobile/src/app/(app)/index.tsx` | Add `<TrackingStatus />` under the session card and the one-time battery tip. After a start that only has start/end tracking, open the background-permission step once. |
| `apps/mobile/src/app/(app)/permissions.tsx` | Support `?step=background` with the "Allow all the time" explanation and the Settings fallback. |
| `apps/mobile/test/setup.ts` | Mocks for `expo-task-manager`, `expo-sqlite`, NetInfo (its official jest mock) and `expo-intent-launcher`. |
| `apps/mobile/test/screens/home.test.tsx` | Update the end-work test for the new request body. Add offline-end and status-line cases. |
| `.gitignore` | Add `apps/mobile/*.apk` and `apps/mobile/android/app/release/`. |

### New files

```
packages/types/src/locations.ts                         BatchPointSchema, LocationBatchSchema, LocationBatchResponse
packages/types/test/locations.test.ts

apps/api/src/modules/sessions/services/current-employee.service.ts   employee record for the signed-in user
apps/api/src/modules/sessions/services/locations.service.ts          batch ingest with time-window check
apps/api/src/modules/sessions/controllers/locations.controller.ts    POST /locations/batch
apps/api/test/e2e/locations.e2e-spec.ts
apps/api/test/e2e/sessions-offline-end.e2e-spec.ts

apps/mobile/src/tracking/constants.ts          task name, 5-minute interval, foreground-service options
apps/mobile/src/tracking/outbox.ts             OutboxStorage interface, backoff, grouping
apps/mobile/src/tracking/outbox-sqlite.ts      SQLite implementation (tables: outbox_points, meta)
apps/mobile/src/tracking/store.ts              getOutbox() singleton + setOutboxForTests()
apps/mobile/src/tracking/uploader.ts           flushOutbox(), flushPendingEnd(), syncNow() (single-flight)
apps/mobile/src/tracking/pending-end.ts        save/read/clear an End work made offline
apps/mobile/src/tracking/background-task.ts    TaskManager.defineTask + toPoint() + handleLocations()
apps/mobile/src/tracking/tracking.ts           startTracking, stopTracking, reconcileTracking, getTrackingStatus
apps/mobile/src/tracking/use-sync-triggers.ts  AppState + NetInfo → syncNow()
apps/mobile/src/tracking/battery.ts            openBatterySettings(), battery-tip flag
apps/mobile/src/components/TrackingStatus.tsx  the Home status line
apps/mobile/test/fakes/memory-outbox.ts        in-memory OutboxStorage for tests
apps/mobile/test/app-config.test.ts
apps/mobile/test/outbox.test.ts
apps/mobile/test/uploader.test.ts
apps/mobile/test/background-task.test.ts
apps/mobile/test/tracking.test.ts
apps/mobile/test/screens/tracking-status.test.tsx
docs/device-test-android.md                    physical-phone checklist + results table (filled in Task 10)
```

---

## Global Constraints

- Everything in `plan.md` → Global Constraints and `plan-phase-2.md` → Global Constraints still applies.
- "Tracking is permitted only when an employee has an active work session" (PRD §4).
  - Tracking starts only after the server confirms the start, and stops before the end request is even sent.
  - The background task ignores any location that arrives when no session id is stored.
- "Capture every five minutes as the product target, subject to Android OS, network, accuracy, and battery constraints" (PRD §4). The interval is `5 * 60_000` ms. Never claim real-time; the copy says "every 5 minutes".
- "Save latitude, longitude, accuracy, speed if supplied, device timestamp, server receipt timestamp, battery level if available, and source" (PRD §4). `source` is `BACKGROUND` for task points. Speed and bearing are stored only when the phone reports them (≥ 0).
- "Queue unsent points locally; sync idempotently when network returns" (PRD §4). This is the SQLite outbox plus server-side de-duplication on `(employee_id, client_point_id)`, which Phase 0–1 already has as a unique index.
- "Show a persistent Android notification while background tracking is active" (PRD §4). It's the expo-location foreground service with `killServiceOnDestroy: false`.
- "Show current tracking status and last successful location time in the employee app" (PRD §7). This is `TrackingStatus` on Home.
- Battery drain mitigation (PRD §9):
  - `Accuracy.Balanced`, not High.
  - No movement threshold (`distanceInterval: 0`), but at most one delivery per 5-minute window.
  - Tracking stops immediately on End work.
- Upload batches: at most 50 points per request (the server allows up to 100). Retry backoff is 30 s, doubling each time, capped at 30 min.
- **Device test before "done"** (plan.pdf): Task 10 records the observed behaviour on a real Android phone in `docs/device-test-android.md`.
- Low memory on this machine: run the Gradle build with the API, web and Docker **stopped**, then start them for testing.

## Review Focus

1. **The phone loses signal for an hour mid-shift.**
   - Expected: about 12 points queue up, upload once when signal returns, arrive in time order with no duplicates, and appear on the dashboard.
   - If End work happened before signal returned, the queued points are still accepted, because they were captured during the session.
   - Tests in Task 2 (server window and dedupe) and Task 6 (backoff, retry, ordering).
2. **End work with no signal.**
   - Expected: tracking stops immediately and the session ends at the tap time, not when signal returns.
   - The screen says the end will be sent later, and it doesn't flip back to "At work" on the next refresh.
   - Tests in Task 3 (server `endedAt`) and Task 8 (pending end, UI).
3. **The app is swiped away or the phone reboots during a shift.**
   - Expected: the notification keeps tracking alive after a swipe.
   - After a reboot, the next app open resumes tracking for the still-running session.
   - Tests in Task 7 (`reconcileTracking`) and Task 10 (device checklist).
4. **The employee refuses "Allow all the time".**
   - Expected: start and end still work and record those two points.
   - Home says plainly that background location is off and links to fix it, and the app doesn't nag on every start.
   - Tests in Task 7 (`startEndOnly` mode) and Task 9 (status line, ask once).
5. **The background task and the open app try to upload at the same moment.**
   - Expected: one upload runs, no point is sent twice, and only one token refresh happens (Phase 2's shared refresh).
   - Test in Task 6 (single-flight `syncNow`).

---

### Task 1: Shared types for location batches and offline end

**Files:**
- Create: `packages/types/src/locations.ts`, `packages/types/test/locations.test.ts`
- Modify: `packages/types/src/sessions.ts`, `packages/types/src/index.ts`

**Interfaces:**
- Produces:
  - `MAX_BATCH_POINTS = 100`
  - `BatchPointSchema`, with input type `BatchPoint` (= `LocationFix` plus `speedMps?`, `bearing?`, `source?: 'BACKGROUND'|'MANUAL'`, which defaults to `BACKGROUND`)
  - `LocationBatchSchema` → `LocationBatchInput { sessionId; points: BatchPoint[] }`
  - `RejectedPoint { clientPointId; reason: 'OUTSIDE_SESSION' }`
  - `LocationBatchResponse { accepted; duplicates; rejected: RejectedPoint[]; lastLocationAt: string|null }`
  - `EndSessionInput` gains `endedAt?: string`

- [ ] **Step 1: Write the failing test.** `packages/types/test/locations.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EndSessionSchema, LocationBatchSchema } from '../src/index.js';

const point = (i: number) => ({
  clientPointId: `6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a${String(i).padStart(2, '0')}`,
  latitude: 19.07,
  longitude: 72.87,
  accuracyMeters: 20,
  capturedAt: '2026-10-06T04:05:00.000Z',
});
const sessionId = '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f';

describe('LocationBatchSchema', () => {
  it('defaults the source to BACKGROUND and keeps speed/bearing', () => {
    const out = LocationBatchSchema.parse({ sessionId, points: [{ ...point(1), speedMps: 1.2, bearing: 90 }] });
    expect(out.points[0]).toMatchObject({ source: 'BACKGROUND', speedMps: 1.2, bearing: 90 });
  });

  it('rejects an empty batch and one over 100 points', () => {
    expect(LocationBatchSchema.safeParse({ sessionId, points: [] }).error?.issues[0]?.message).toBe('Send at least one point.');
    const many = Array.from({ length: 101 }, (_, i) => point(i));
    expect(LocationBatchSchema.safeParse({ sessionId, points: many }).error?.issues[0]?.message).toBe('Send at most 100 points at a time.');
  });

  it('rejects negative speed (phones report -1 for unknown)', () => {
    expect(LocationBatchSchema.safeParse({ sessionId, points: [{ ...point(1), speedMps: -1 }] }).success).toBe(false);
  });
});

describe('EndSessionSchema', () => {
  it('accepts an optional endedAt for an end made offline', () => {
    expect(EndSessionSchema.parse({ deviceTime: '2026-10-06T12:00:00.000Z', endedAt: '2026-10-06T11:58:00.000Z' }).endedAt).toBe('2026-10-06T11:58:00.000Z');
  });
});
```
Run `pnpm --filter @worktrail/types test` → FAIL.

- [ ] **Step 2: Implement.** `packages/types/src/locations.ts`:
```ts
import { z } from 'zod';
import { LocationFixSchema } from './sessions.js';

export const MAX_BATCH_POINTS = 100;

export const BatchPointSchema = LocationFixSchema.extend({
  speedMps: z.number().min(0).max(100).nullable().optional(),
  bearing: z.number().min(0).max(360).nullable().optional(),
  source: z.enum(['BACKGROUND', 'MANUAL']).default('BACKGROUND'),
});
export type BatchPoint = z.input<typeof BatchPointSchema>;

export const LocationBatchSchema = z.object({
  sessionId: z.string().uuid(),
  points: z
    .array(BatchPointSchema)
    .min(1, 'Send at least one point.')
    .max(MAX_BATCH_POINTS, `Send at most ${MAX_BATCH_POINTS} points at a time.`),
});
export type LocationBatchInput = z.output<typeof LocationBatchSchema>;

export type RejectedPoint = { clientPointId: string; reason: 'OUTSIDE_SESSION' };

export type LocationBatchResponse = {
  /** Newly stored points. */
  accepted: number;
  /** Points the server already had (a retry); safe to drop from the phone's queue. */
  duplicates: number;
  /** Points not stored; also safe to drop. */
  rejected: RejectedPoint[];
  lastLocationAt: string | null;
};
```
In `packages/types/src/sessions.ts`, change `EndSessionSchema` to:
```ts
export const EndSessionSchema = z.object({
  deviceTime: z.string().datetime(),
  /** The phone's estimate of server time when End was tapped (matters when ended offline). */
  endedAt: z.string().datetime().optional(),
  finalLocation: LocationFixSchema.optional(),
});
```
Append `export * from './locations.js';` to `index.ts`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(types): location batch and offline end contracts"`

---

### Task 2: `POST /locations/batch` (API)

**Files:**
- Create: `apps/api/src/modules/sessions/services/current-employee.service.ts`, `apps/api/src/modules/sessions/services/locations.service.ts`, `apps/api/src/modules/sessions/controllers/locations.controller.ts`, `apps/api/test/e2e/locations.e2e-spec.ts`
- Modify: `apps/api/src/modules/sessions/services/sessions.service.ts` (use `CurrentEmployeeService`), `apps/api/src/modules/sessions/sessions.module.ts`

**Interfaces:**
- Consumes: `LocationBatchSchema`, `LocationBatchResponse` (Task 1), `qualityFor` (Phase 2), `employeeAs` test helper (Phase 2).
- Produces:
  - `CurrentEmployeeService.forAuth(auth): Promise<Employee>`, which throws 403 `NOT_AN_EMPLOYEE`
  - `POST /api/v1/locations/batch` (EMPLOYEE, header `Idempotency-Key` required) → 200 `LocationBatchResponse`. Errors:
    - 400 `IDEMPOTENCY_KEY_REQUIRED`
    - 400 `VALIDATION_FAILED`
    - 404 `NOT_FOUND` (not your session, or a malformed id)
    - 403 for admins
  - Session window rule: a point is stored only if `startedAtServer − 2 min ≤ capturedAt ≤ (endedAtServer ?? now) + 2 min`.

- [ ] **Step 1: Write the failing e2e test.** `apps/api/test/e2e/locations.e2e-spec.ts`:
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
const pt = (capturedAt: string, over: Record<string, unknown> = {}) => ({
  clientPointId: randomUUID(),
  latitude: 19.07,
  longitude: 72.87,
  accuracyMeters: 25,
  capturedAt,
  ...over,
});

describe('POST /locations/batch', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const batch = (token: string, body: object, key: string | null = randomUUID()) => {
    const r = http().post('/api/v1/locations/batch').set('Authorization', `Bearer ${token}`);
    return (key ? r.set('Idempotency-Key', key) : r).send(body);
  };
  async function working() {
    const e = await employeeAs(app, prisma);
    const s = await http()
      .post('/api/v1/sessions/start')
      .set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() })
      .expect(201);
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

  it('stores background points with source and quality, and reports the last time', async () => {
    const e = await working();
    const res = await batch(e.token, {
      sessionId: e.sessionId,
      points: [pt(minutesAgo(10), { speedMps: 1.4, bearing: 180 }), pt(minutesAgo(5), { accuracyMeters: 300 })],
    }).expect(200);
    expect(res.body).toEqual({ accepted: 2, duplicates: 0, rejected: [], lastLocationAt: expect.any(String) });
    const rows = await prisma.locationPoint.findMany({ orderBy: { capturedAt: 'asc' } });
    expect(rows.map((r) => [r.source, r.qualityFlag])).toEqual([['BACKGROUND', 'GOOD'], ['BACKGROUND', 'LOW_ACCURACY']]);
    expect(Number(rows[0]!.speedMps)).toBe(1.4);
  });

  it('a retried batch is counted as duplicates, never stored twice', async () => {
    const e = await working();
    const body = { sessionId: e.sessionId, points: [pt(minutesAgo(10)), pt(minutesAgo(5))] };
    await batch(e.token, body).expect(200);
    const again = await batch(e.token, body).expect(200);
    expect(again.body).toMatchObject({ accepted: 0, duplicates: 2 });
    expect(await prisma.locationPoint.count()).toBe(2);
  });

  it('accepts points captured during the session even after End work (offline upload)', async () => {
    const e = await working();
    const during = pt(minutesAgo(20));
    await http().post(`/api/v1/sessions/${e.sessionId}/end`).set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(200);
    const res = await batch(e.token, { sessionId: e.sessionId, points: [during] }).expect(200);
    expect(res.body.accepted).toBe(1);
  });

  it('rejects points captured outside the session window, without failing the rest', async () => {
    const e = await working();
    const before = pt(minutesAgo(180));
    const good = pt(minutesAgo(30));
    const res = await batch(e.token, { sessionId: e.sessionId, points: [before, good] }).expect(200);
    expect(res.body).toMatchObject({ accepted: 1, rejected: [{ clientPointId: before.clientPointId, reason: 'OUTSIDE_SESSION' }] });
  });

  it('requires an Idempotency-Key header', async () => {
    const e = await working();
    const res = await batch(e.token, { sessionId: e.sessionId, points: [pt(minutesAgo(1))] }, null).expect(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it("returns 404 for another employee's session, same company or not", async () => {
    const a = await working();
    const colleague = await employeeAs(app, prisma, a.user.companyId);
    const outsider = await employeeAs(app, prisma);
    await batch(colleague.token, { sessionId: a.sessionId, points: [pt(minutesAgo(1))] }).expect(404);
    await batch(outsider.token, { sessionId: a.sessionId, points: [pt(minutesAgo(1))] }).expect(404);
    expect(await prisma.locationPoint.count()).toBe(0);
  });

  it('admins cannot upload points', async () => {
    const admin = await signupAs(app);
    await batch(admin.token, { sessionId: randomUUID(), points: [pt(minutesAgo(1))] }).expect(403);
  });

  it('validates the batch with field messages', async () => {
    const e = await working();
    const res = await batch(e.token, { sessionId: e.sessionId, points: [] }).expect(400);
    expect(res.body.error.details.fields.points).toBe('Send at least one point.');
  });
});
```
Run `cd apps/api && pnpm exec vitest run --config vitest.config.e2e.ts test/e2e/locations` → FAIL (404 route).

- [ ] **Step 2: Implement.**

`src/modules/sessions/services/current-employee.service.ts`:
```ts
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
```
In `sessions.service.ts`, inject `CurrentEmployeeService` and replace every `this.employeeFor(auth)` with `this.currentEmployee.forAuth(auth)`. Delete the private `employeeFor` method.

`src/modules/sessions/services/locations.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LocationBatchInput, LocationBatchResponse, RejectedPoint } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { qualityFor } from '../../../common/utils/location-quality.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from './current-employee.service.js';

/** Clock wiggle allowed between phone and server at the edges of a session. */
const WINDOW_SLACK_MS = 2 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  /**
   * Stores queued background points. Idempotent per point via the unique
   * (employee_id, client_point_id) index, so whole-batch retries are safe.
   */
  async batch(auth: AuthContext, input: LocationBatchInput): Promise<LocationBatchResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const session = UUID.test(input.sessionId)
      ? await this.prisma.workSession.findFirst({ where: { id: input.sessionId, employeeId: employee.id } })
      : null;
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Work session not found.');

    const now = new Date();
    const from = session.startedAtServer.getTime() - WINDOW_SLACK_MS;
    const to = (session.endedAtServer ?? now).getTime() + WINDOW_SLACK_MS;

    const rejected: RejectedPoint[] = [];
    const rows: Prisma.LocationPointCreateManyInput[] = [];
    for (const p of input.points) {
      const capturedAt = new Date(p.capturedAt);
      if (capturedAt.getTime() < from || capturedAt.getTime() > to) {
        rejected.push({ clientPointId: p.clientPointId, reason: 'OUTSIDE_SESSION' });
        continue;
      }
      rows.push({
        companyId: employee.companyId,
        employeeId: employee.id,
        sessionId: session.id,
        clientPointId: p.clientPointId,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyMeters: p.accuracyMeters ?? null,
        speedMps: p.speedMps ?? null,
        bearing: p.bearing ?? null,
        batteryLevel: p.batteryLevel ?? null,
        source: p.source,
        capturedAt,
        qualityFlag: qualityFor(p.accuracyMeters, capturedAt, now),
      });
    }

    const created = rows.length
      ? await this.prisma.locationPoint.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };
    const last = await this.prisma.locationPoint.aggregate({
      where: { sessionId: session.id },
      _max: { capturedAt: true },
    });
    return {
      accepted: created.count,
      duplicates: rows.length - created.count,
      rejected,
      lastLocationAt: last._max.capturedAt?.toISOString() ?? null,
    };
  }
}
```

`src/modules/sessions/controllers/locations.controller.ts`:
```ts
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { type LocationBatchInput, LocationBatchSchema } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { LocationsService } from '../services/locations.service.js';

@Roles('EMPLOYEE')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('batch')
  @HttpCode(200)
  batch(
    @CurrentAuth() auth: AuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodBody(LocationBatchSchema)) body: LocationBatchInput,
  ) {
    // De-duplication is per point (client_point_id); the key is required by the API
    // contract so clients always retry with the same batch identity.
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with each batch.');
    }
    return this.locations.batch(auth, body);
  }
}
```
`sessions.module.ts`: `controllers: [SessionsController, LocationsController]` and `providers: [SessionsService, LocationsService, CurrentEmployeeService]`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint` → PASS. The Phase 2 sessions tests still pass after the refactor.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): idempotent location batch upload with session time window"`

---

### Task 3: End work made offline keeps its real end time (API)

**Files:**
- Create: `apps/api/test/e2e/sessions-offline-end.e2e-spec.ts`
- Modify: `apps/api/src/modules/sessions/services/sessions.service.ts` (`end()`)

**Interfaces:**
- Produces: in `POST /sessions/:id/end`, when the body includes `endedAt`, `endedAtServer` becomes `endedAt` limited to the range `[startedAtServer, now]`, and `totalMinutes` is computed from that value.

- [ ] **Step 1: Write the failing test.** `apps/api/test/e2e/sessions-offline-end.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('ending work that was ended offline', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function sessionStarted(minutesAgo: number) {
    const e = await employeeAs(app, prisma);
    const s = await http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${e.token}`)
      .send({ deviceTime: new Date().toISOString() }).expect(201);
    await prisma.workSession.update({
      where: { id: s.body.session.id },
      data: { startedAtServer: new Date(Date.now() - minutesAgo * 60_000) },
    });
    return { token: e.token, id: s.body.session.id as string };
  }
  const end = (token: string, id: string, endedAt: string) =>
    http().post(`/api/v1/sessions/${id}/end`).set('Authorization', `Bearer ${token}`)
      .send({ deviceTime: endedAt, endedAt });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('uses the tap time, not the time the request finally arrived', async () => {
    const s = await sessionStarted(120);
    const tappedAt = new Date(Date.now() - 45 * 60_000).toISOString(); // ended 45 min ago, synced now
    const res = await end(s.token, s.id, tappedAt).expect(200);
    expect(res.body.session.totalMinutes).toBe(75);
    expect(res.body.session.endedAt).toBe(tappedAt);
  });

  it('never ends before the start', async () => {
    const s = await sessionStarted(30);
    const res = await end(s.token, s.id, new Date(Date.now() - 5 * 3600_000).toISOString()).expect(200);
    expect(res.body.session.totalMinutes).toBe(0);
  });

  it('never ends in the future', async () => {
    const s = await sessionStarted(30);
    const res = await end(s.token, s.id, new Date(Date.now() + 3600_000).toISOString()).expect(200);
    expect(res.body.session.totalMinutes).toBe(30);
  });
});
```
Run it → the first test FAILS (totalMinutes is 120).

- [ ] **Step 2: Implement.** In `sessions.service.ts` `end()`, replace the `const now = new Date(); const totalMinutes = …` lines with:
```ts
    const now = new Date();
    // An end made offline reaches us late; trust the tap time, but only inside [start, now].
    const requested = input.endedAt ? new Date(input.endedAt) : now;
    const endedAt = new Date(
      Math.min(Math.max(requested.getTime(), session.startedAtServer.getTime()), now.getTime()),
    );
    const totalMinutes = Math.round((endedAt.getTime() - session.startedAtServer.getTime()) / 60_000);
```
and in the `updateMany` data use `endedAtServer: endedAt` (instead of `now`). The END point's quality check keeps using `now`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): keep the real end time for work ended offline"`

---

### Task 4: Development build with background location enabled (mobile)

**Files:**
- Create: `apps/mobile/test/app-config.test.ts`
- Modify: `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/test/setup.ts`, `.gitignore`

**Interfaces:**
- Produces: an installable debug build (`pnpm --filter @worktrail/mobile android:dev`) and a shareable APK (`android:apk`). The app config carries the permissions and plugins later tasks depend on.

- [ ] **Step 1: Read the bundled docs.** After installing (Step 3), read `apps/mobile/node_modules/expo-location/README.md` (or the docs URL it links) on **background location**, `startLocationUpdatesAsync` options and the **foreground service**. Also read the `expo-task-manager` and `expo-sqlite` READMEs. In particular, check whether `startLocationUpdatesAsync` requires the *background* permission on Android in SDK 57. If any option name below differs, use the documented name and ledger a ruling.

- [ ] **Step 2: Write the failing config test.** `test/app-config.test.ts`:
```ts
import appJson from '../app.json';

const expo = appJson.expo as {
  android: { permissions: string[] };
  plugins: Array<string | [string, Record<string, unknown>]>;
};
const plugin = (name: string) =>
  expo.plugins.find((p) => (Array.isArray(p) ? p[0] === name : p === name));

describe('app config for background tracking', () => {
  it('declares the Android permissions background tracking needs', () => {
    expect(expo.android.permissions).toEqual(
      expect.arrayContaining([
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
      ]),
    );
  });

  it('enables background location and the foreground service in expo-location', () => {
    expect(plugin('expo-location')).toEqual([
      'expo-location',
      expect.objectContaining({ isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }),
    ]);
  });

  it('includes sqlite and build properties', () => {
    expect(plugin('expo-sqlite')).toBeTruthy();
    expect(plugin('expo-build-properties')).toBeTruthy();
  });
});
```
Add `"resolveJsonModule": true` to `apps/mobile/tsconfig.json` `compilerOptions` if the template doesn't have it. Run `pnpm --filter @worktrail/mobile test` → FAIL.

- [ ] **Step 3: Install and configure.**
```bash
cd apps/mobile
pnpm expo install expo-task-manager expo-sqlite @react-native-community/netinfo expo-intent-launcher expo-build-properties
cd ../..
```
In `app.json`:
- Set `android.permissions` to `["ACCESS_COARSE_LOCATION","ACCESS_FINE_LOCATION","ACCESS_BACKGROUND_LOCATION","FOREGROUND_SERVICE","FOREGROUND_SERVICE_LOCATION","POST_NOTIFICATIONS"]`.
- Replace the `expo-location` plugin entry with:
```json
[
  "expo-location",
  {
    "locationWhenInUsePermission": "Work Trail records your location when you start and end work, so your company can see where your work day began and finished.",
    "locationAlwaysAndWhenInUsePermission": "Work Trail records your location about every 5 minutes while you are at work, even when the screen is off. Nothing is recorded after you tap End work.",
    "isAndroidBackgroundLocationEnabled": true,
    "isAndroidForegroundServiceEnabled": true
  }
]
```
- Add `"expo-sqlite"` and:
```json
[
  "expo-build-properties",
  { "android": { "usesCleartextTraffic": true, "minSdkVersion": 29 } }
]
```
`usesCleartextTraffic` lets the debug build reach the local `http://` API. Phase 7 turns it off once the API is on HTTPS. `minSdkVersion: 29` means Android 10+, which the PRD requires.

`package.json` scripts:
```json
"android:dev": "expo run:android",
"android:apk": "expo prebuild --platform android && cd android && gradlew.bat assembleRelease"
```
`.gitignore`: add `apps/mobile/*.apk` and `apps/mobile/android/app/release/` (`apps/mobile/android/` is already ignored from Phase 2).

`test/setup.ts`: append
```ts
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn(async () => false) }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn(), ActivityAction: { IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' } }));
```

- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test` → PASS (all Phase 2 tests and 3 new ones).

- [ ] **Step 5: Build and install on the phone (memory-safe order).**
1. Stop the API, web and Docker (`docker compose stop`) so Gradle has memory.
2. Check `java -version`. Expected: 17 or newer (SDK 57 requirement). If it's older, install Temurin 17 and set `JAVA_HOME`.
3. Plug in the Android phone with USB debugging on. Check that `adb devices` lists it.
4. Run `pnpm --filter @worktrail/mobile android:dev`. Expected: Gradle builds, and "Work Trail" installs and opens on the phone, showing the Phase 2 Welcome screen.

If the build runs out of memory, add `org.gradle.jvmargs=-Xmx2048m` to `apps/mobile/android/gradle.properties` through the `expo-build-properties` plugin, and ledger it.

- [ ] **Step 6: Commit.** `git commit -m "build(mobile): development build with background location, sqlite and foreground service"`

---

### Task 5: On-phone outbox (mobile)

**Files:**
- Create: `apps/mobile/src/tracking/outbox.ts`, `apps/mobile/src/tracking/outbox-sqlite.ts`, `apps/mobile/src/tracking/store.ts`, `apps/mobile/test/fakes/memory-outbox.ts`, `apps/mobile/test/outbox.test.ts`

**Interfaces:**
- Produces:
  - `OutboxRow { clientPointId; sessionId; payload: BatchPoint; attempts: number; nextAttemptAt: number }`
  - `OutboxStorage` with methods `insert(rows)`, `due(now, limit)` (ordered by `payload.capturedAt`), `update(rows)`, `remove(ids)`, `count()`, `clear()`, `getMeta(key)`, `setMeta(key, value|null)`
  - `MetaKey = 'trackingSessionId'|'lastSentAt'|'pendingEnd'|'batteryTipShown'|'askedBackground'`
  - `backoffMs(attempts)`
  - `groupBySession(rows): Map<string, OutboxRow[]>`
  - `getOutbox(): Promise<OutboxStorage>` and `setOutboxForTests(s | null)`
  - `MemoryOutbox` (test fake)

- [ ] **Step 1: Write the failing test.** `test/outbox.test.ts`:
```ts
import { backoffMs, groupBySession, type OutboxRow } from '../src/tracking/outbox';
import { MemoryOutbox } from './fakes/memory-outbox';

const row = (id: string, sessionId: string, capturedAt: string, nextAttemptAt = 0): OutboxRow => ({
  clientPointId: id,
  sessionId,
  payload: { clientPointId: id, latitude: 19, longitude: 72, capturedAt },
  attempts: 0,
  nextAttemptAt,
});

describe('outbox', () => {
  it('backs off 30 s, doubling, capped at 30 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(20)).toBe(30 * 60_000);
  });

  it('groups rows by session, keeping time order', () => {
    const g = groupBySession([row('a', 's1', '2026-10-06T04:00:00Z'), row('b', 's2', '2026-10-06T04:01:00Z'), row('c', 's1', '2026-10-06T04:02:00Z')]);
    expect([...g.entries()].map(([s, rows]) => [s, rows.map((r) => r.clientPointId)])).toEqual([['s1', ['a', 'c']], ['s2', ['b']]]);
  });

  it('storage: ignores duplicate ids, returns due rows oldest first, honours nextAttemptAt', async () => {
    const box = new MemoryOutbox();
    await box.insert([row('b', 's', '2026-10-06T04:05:00Z'), row('a', 's', '2026-10-06T04:00:00Z'), row('later', 's', '2026-10-06T04:10:00Z', 10_000)]);
    await box.insert([row('a', 's', '2026-10-06T04:00:00Z')]);
    expect(await box.count()).toBe(3);
    expect((await box.due(5_000, 10)).map((r) => r.clientPointId)).toEqual(['a', 'b']);
    await box.remove(['a']);
    expect(await box.count()).toBe(2);
  });

  it('storage: meta values round-trip and clear', async () => {
    const box = new MemoryOutbox();
    await box.setMeta('trackingSessionId', 's1');
    expect(await box.getMeta('trackingSessionId')).toBe('s1');
    await box.setMeta('trackingSessionId', null);
    expect(await box.getMeta('trackingSessionId')).toBeNull();
  });
});
```
Run it → FAIL.

- [ ] **Step 2: Implement.**

`src/tracking/outbox.ts`:
```ts
import type { BatchPoint } from '@worktrail/types';

export type OutboxRow = {
  clientPointId: string;
  sessionId: string;
  payload: BatchPoint;
  attempts: number;
  /** Epoch ms; the row is not retried before this. */
  nextAttemptAt: number;
};

export type MetaKey = 'trackingSessionId' | 'lastSentAt' | 'pendingEnd' | 'batteryTipShown' | 'askedBackground';

/** Points waiting to be uploaded, plus a few small tracking flags. Survives app restarts. */
export interface OutboxStorage {
  insert(rows: OutboxRow[]): Promise<void>;
  due(now: number, limit: number): Promise<OutboxRow[]>;
  update(rows: Array<Pick<OutboxRow, 'clientPointId' | 'attempts' | 'nextAttemptAt'>>): Promise<void>;
  remove(ids: string[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  getMeta(key: MetaKey): Promise<string | null>;
  setMeta(key: MetaKey, value: string | null): Promise<void>;
}

const BASE_MS = 30_000;
const MAX_MS = 30 * 60_000;

export const backoffMs = (attempts: number) => Math.min(BASE_MS * 2 ** Math.max(0, attempts - 1), MAX_MS);

export function groupBySession(rows: OutboxRow[]): Map<string, OutboxRow[]> {
  const groups = new Map<string, OutboxRow[]>();
  for (const r of rows) {
    const list = groups.get(r.sessionId) ?? [];
    list.push(r);
    groups.set(r.sessionId, list);
  }
  return groups;
}
```

`src/tracking/outbox-sqlite.ts`:
```ts
import * as SQLite from 'expo-sqlite';
import type { MetaKey, OutboxRow, OutboxStorage } from './outbox';

type DbRow = { client_point_id: string; session_id: string; payload: string; attempts: number; next_attempt_at: number };

export async function openSqliteOutbox(): Promise<OutboxStorage> {
  const db = await SQLite.openDatabaseAsync('worktrail.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS outbox_points (
      client_point_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS outbox_due ON outbox_points (next_attempt_at, captured_at);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);

  const toRow = (r: DbRow): OutboxRow => ({
    clientPointId: r.client_point_id,
    sessionId: r.session_id,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
  });

  return {
    async insert(rows) {
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync(
            'INSERT OR IGNORE INTO outbox_points (client_point_id, session_id, captured_at, payload, attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)',
            r.clientPointId, r.sessionId, r.payload.capturedAt, JSON.stringify(r.payload), r.attempts, r.nextAttemptAt,
          );
        }
      });
    },
    async due(now, limit) {
      const rows = await db.getAllAsync<DbRow>(
        'SELECT client_point_id, session_id, payload, attempts, next_attempt_at FROM outbox_points WHERE next_attempt_at <= ? ORDER BY captured_at LIMIT ?',
        now, limit,
      );
      return rows.map(toRow);
    },
    async update(rows) {
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync('UPDATE outbox_points SET attempts = ?, next_attempt_at = ? WHERE client_point_id = ?', r.attempts, r.nextAttemptAt, r.clientPointId);
        }
      });
    },
    async remove(ids) {
      if (!ids.length) return;
      await db.runAsync(`DELETE FROM outbox_points WHERE client_point_id IN (${ids.map(() => '?').join(',')})`, ...ids);
    },
    async count() {
      return (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox_points'))?.n ?? 0;
    },
    async clear() {
      await db.execAsync('DELETE FROM outbox_points; DELETE FROM meta;');
    },
    async getMeta(key: MetaKey) {
      return (await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key))?.value ?? null;
    },
    async setMeta(key: MetaKey, value: string | null) {
      if (value === null) await db.runAsync('DELETE FROM meta WHERE key = ?', key);
      else await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    },
  };
}
```

`src/tracking/store.ts`:
```ts
import type { OutboxStorage } from './outbox';
import { openSqliteOutbox } from './outbox-sqlite';

let instance: Promise<OutboxStorage> | null = null;

/** One outbox per process (the app and the headless background task each open their own). */
export function getOutbox(): Promise<OutboxStorage> {
  instance ??= openSqliteOutbox();
  return instance;
}

export function setOutboxForTests(storage: OutboxStorage | null) {
  instance = storage ? Promise.resolve(storage) : null;
}
```

`test/fakes/memory-outbox.ts`:
```ts
import type { MetaKey, OutboxRow, OutboxStorage } from '../../src/tracking/outbox';

export class MemoryOutbox implements OutboxStorage {
  rows = new Map<string, OutboxRow>();
  meta = new Map<MetaKey, string>();

  async insert(rows: OutboxRow[]) {
    for (const r of rows) if (!this.rows.has(r.clientPointId)) this.rows.set(r.clientPointId, { ...r });
  }
  async due(now: number, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.nextAttemptAt <= now)
      .sort((a, b) => a.payload.capturedAt.localeCompare(b.payload.capturedAt))
      .slice(0, limit);
  }
  async update(rows: Array<Pick<OutboxRow, 'clientPointId' | 'attempts' | 'nextAttemptAt'>>) {
    for (const r of rows) {
      const cur = this.rows.get(r.clientPointId);
      if (cur) this.rows.set(r.clientPointId, { ...cur, attempts: r.attempts, nextAttemptAt: r.nextAttemptAt });
    }
  }
  async remove(ids: string[]) {
    for (const id of ids) this.rows.delete(id);
  }
  async count() {
    return this.rows.size;
  }
  async clear() {
    this.rows.clear();
    this.meta.clear();
  }
  async getMeta(key: MetaKey) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: MetaKey, value: string | null) {
    if (value === null) this.meta.delete(key);
    else this.meta.set(key, value);
  }
}
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): durable on-phone outbox for location points"`

---

### Task 6: Uploader with batching, backoff and a single-flight lock (mobile)

**Files:**
- Create: `apps/mobile/src/tracking/uploader.ts`, `apps/mobile/src/tracking/pending-end.ts`, `apps/mobile/test/uploader.test.ts`
- Modify: `apps/mobile/src/api/client.ts` (`opts.headers`), `apps/mobile/test/api-client.test.ts` (one new case)

**Interfaces:**
- Consumes: `api`, `ApiError`, `getOutbox`, `backoffMs`, `groupBySession`, `LocationBatchResponse`.
- Produces:
  - `flushOutbox(now?: () => number): Promise<FlushResult>`, where `FlushResult = { sent: number; dropped: number; pending: number; stopped: 'DONE'|'OFFLINE'|'SIGNED_OUT' }`
  - `PendingEnd = { sessionId: string; body: EndSessionInput }`
  - `savePendingEnd`, `readPendingEnd`, `clearPendingEnd`
  - `flushPendingEnd(): Promise<'none'|'sent'|'kept'>`
  - `syncNow(): Promise<void>` (single-flight: concurrent calls share one run)

- [ ] **Step 1: Write the failing tests.**

Add to `test/api-client.test.ts`:
```ts
  it('passes extra headers such as Idempotency-Key', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValueOnce(ok({}));
    await client.request('POST', '/locations/batch', {}, { headers: { 'idempotency-key': 'k1' } });
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'idempotency-key': 'k1' });
  });
```

`test/uploader.test.ts`:
```ts
import { setOutboxForTests } from '../src/tracking/store';
import { flushOutbox, flushPendingEnd, syncNow } from '../src/tracking/uploader';
import { savePendingEnd } from '../src/tracking/pending-end';
import { useAuthStore } from '../src/auth/auth-store';
import { MemoryOutbox } from './fakes/memory-outbox';
import type { OutboxRow } from '../src/tracking/outbox';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const okBatch = (accepted: number, rejected: string[] = []) =>
  json({ accepted, duplicates: 0, rejected: rejected.map((id) => ({ clientPointId: id, reason: 'OUTSIDE_SESSION' })), lastLocationAt: null });

const row = (i: number, sessionId = 's1'): OutboxRow => ({
  clientPointId: `p${String(i).padStart(3, '0')}`,
  sessionId,
  payload: { clientPointId: `p${String(i).padStart(3, '0')}`, latitude: 19, longitude: 72, capturedAt: new Date(Date.UTC(2026, 9, 6, 4, i)).toISOString(), source: 'BACKGROUND' },
  attempts: 0,
  nextAttemptAt: 0,
});

let box: MemoryOutbox;
beforeEach(() => {
  fetchMock.mockReset();
  box = new MemoryOutbox();
  setOutboxForTests(box);
  useAuthStore.setState({ status: 'signedIn', accessToken: 'at' });
});

describe('uploader', () => {
  it('uploads in batches of 50, oldest first, and empties the queue', async () => {
    await box.insert(Array.from({ length: 120 }, (_, i) => row(i)));
    fetchMock.mockImplementation((_u: string, init: RequestInit) => okBatch(JSON.parse(String(init.body)).points.length));
    const r = await flushOutbox();
    expect(r).toMatchObject({ sent: 120, pending: 0, stopped: 'DONE' });
    const sizes = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).points.length);
    expect(sizes).toEqual([50, 50, 20]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).points[0].clientPointId).toBe('p000');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toHaveProperty('idempotency-key');
    expect(await box.getMeta('lastSentAt')).not.toBeNull();
  });

  it('keeps points and backs off when offline', async () => {
    await box.insert([row(1), row(2)]);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const r = await flushOutbox(() => 1_000);
    expect(r).toMatchObject({ sent: 0, pending: 2, stopped: 'OFFLINE' });
    expect([...box.rows.values()].map((x) => [x.attempts, x.nextAttemptAt])).toEqual([[1, 31_000], [1, 31_000]]);
  });

  it('drops server-rejected points and points for a session that no longer exists', async () => {
    await box.insert([row(1), row(2), row(3, 'gone')]);
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      JSON.parse(String(init.body)).sessionId === 'gone'
        ? json({ error: { code: 'NOT_FOUND', message: 'Work session not found.', details: {} } }, 404)
        : okBatch(1, ['p001']),
    );
    const r = await flushOutbox();
    expect(r).toMatchObject({ sent: 1, dropped: 2, pending: 0 });
  });

  it('two simultaneous syncs upload each point once', async () => {
    await box.insert([row(1), row(2)]);
    fetchMock.mockImplementation(async (_u: string, init: RequestInit) => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ accepted: JSON.parse(String(init.body)).points.length, duplicates: 0, rejected: [], lastLocationAt: null }));
    });
    await Promise.all([syncNow(), syncNow()]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/locations/batch'))).toHaveLength(1);
  });

  it('sends a queued End work and clears it; keeps it while offline', async () => {
    await savePendingEnd({ sessionId: 's1', body: { deviceTime: '2026-10-06T12:00:00.000Z', endedAt: '2026-10-06T12:00:00.000Z' } });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await flushPendingEnd()).toBe('kept');
    fetchMock.mockReturnValueOnce(json({ session: {}, serverTime: '2026-10-06T12:30:00.000Z' }));
    expect(await flushPendingEnd()).toBe('sent');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/sessions\/s1\/end$/);
    expect(await box.getMeta('pendingEnd')).toBeNull();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.**

`src/api/client.ts`: change the `request` signature to `request<T>(method, path, body?, opts: { auth?: boolean; headers?: Record<string, string> } = {})`, give `send()` an `extraHeaders` parameter spread into `headers`, and pass `opts.headers` on both the first attempt and the retry.

`src/tracking/pending-end.ts`:
```ts
import type { EndSessionInput } from '@worktrail/types';
import { getOutbox } from './store';

/** An End work tapped with no signal, waiting to be sent. */
export type PendingEnd = { sessionId: string; body: EndSessionInput };

export async function savePendingEnd(p: PendingEnd) {
  await (await getOutbox()).setMeta('pendingEnd', JSON.stringify(p));
}

export async function readPendingEnd(): Promise<PendingEnd | null> {
  const raw = await (await getOutbox()).getMeta('pendingEnd');
  return raw ? (JSON.parse(raw) as PendingEnd) : null;
}

export async function clearPendingEnd() {
  await (await getOutbox()).setMeta('pendingEnd', null);
}
```

`src/tracking/uploader.ts`:
```ts
import type { LocationBatchResponse } from '@worktrail/types';
import { api, ApiError } from '../api';
import { backoffMs, groupBySession, type OutboxRow } from './outbox';
import { clearPendingEnd, readPendingEnd } from './pending-end';
import { getOutbox } from './store';

const BATCH_SIZE = 50;
const SCAN_LIMIT = BATCH_SIZE * 4;

export type FlushResult = { sent: number; dropped: number; pending: number; stopped: 'DONE' | 'OFFLINE' | 'SIGNED_OUT' };

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** A server answer that means "this batch will never succeed": stop retrying it. */
const isPermanent = (e: unknown) => e instanceof ApiError && (e.status === 400 || e.status === 403 || e.status === 404);

export async function flushOutbox(now: () => number = Date.now): Promise<FlushResult> {
  const box = await getOutbox();
  let sent = 0;
  let dropped = 0;

  for (;;) {
    const due = await box.due(now(), SCAN_LIMIT);
    if (due.length === 0) break;
    for (const [sessionId, rows] of groupBySession(due)) {
      for (const chunk of chunks(rows, BATCH_SIZE)) {
        const ids = chunk.map((r) => r.clientPointId);
        try {
          const res = await api.request<LocationBatchResponse>(
            'POST',
            '/locations/batch',
            { sessionId, points: chunk.map((r) => r.payload) },
            { headers: { 'idempotency-key': `${ids[0]}:${ids.length}` } },
          );
          // Accepted, duplicate and rejected points are all finished with.
          await box.remove(ids);
          sent += ids.length - res.rejected.length;
          dropped += res.rejected.length;
          await box.setMeta('lastSentAt', new Date(now()).toISOString());
        } catch (e) {
          if (isPermanent(e)) {
            await box.remove(ids);
            dropped += ids.length;
            continue;
          }
          if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
            return { sent, dropped, pending: await box.count(), stopped: 'SIGNED_OUT' };
          }
          await box.update(chunk.map((r: OutboxRow) => ({
            clientPointId: r.clientPointId,
            attempts: r.attempts + 1,
            nextAttemptAt: now() + backoffMs(r.attempts + 1),
          })));
          return { sent, dropped, pending: await box.count(), stopped: 'OFFLINE' };
        }
      }
    }
  }
  return { sent, dropped, pending: await box.count(), stopped: 'DONE' };
}

export async function flushPendingEnd(): Promise<'none' | 'sent' | 'kept'> {
  const pending = await readPendingEnd();
  if (!pending) return 'none';
  try {
    await api.request('POST', `/sessions/${pending.sessionId}/end`, pending.body);
  } catch (e) {
    const alreadyEnded = e instanceof ApiError && (e.code === 'SESSION_NOT_ACTIVE' || e.status === 404);
    if (!alreadyEnded) return 'kept';
  }
  await clearPendingEnd();
  return 'sent';
}

let running: Promise<void> | null = null;

/** Uploads queued points, then any queued End work. Concurrent callers share one run. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    try {
      await flushOutbox();
      await flushPendingEnd();
    } finally {
      running = null;
    }
  })();
  return running;
}
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): batched, idempotent uploader with backoff and single-flight sync"`

---

### Task 7: Background task and tracking control (mobile)

**Files:**
- Create: `apps/mobile/src/tracking/constants.ts`, `apps/mobile/src/tracking/background-task.ts`, `apps/mobile/src/tracking/tracking.ts`, `apps/mobile/test/background-task.test.ts`, `apps/mobile/test/tracking.test.ts`
- Modify: `apps/mobile/src/location/location.ts` (background permission), `apps/mobile/src/app/_layout.tsx` (import the task first)

**Interfaces:**
- Produces:
  - `TASK_NAME = 'worktrail-location'`, `INTERVAL_MS = 300_000`, `TRACKING_OPTIONS`
  - `toPoint(loc, uuid): BatchPoint`
  - `handleLocations(locations): Promise<void>`
  - `TrackingMode = 'background'|'startEndOnly'`
  - `startTracking(sessionId): Promise<TrackingMode>`
  - `stopTracking(): Promise<void>`
  - `reconcileTracking(activeSessionId: string|null): Promise<void>`
  - `TrackingStatus { mode: 'background'|'startEndOnly'|'off'; pending; lastSentAt: string|null; pendingEnd: boolean }`
  - `getTrackingStatus(): Promise<TrackingStatus>`
  - `getBackgroundPermission()` and `requestBackgroundPermission()`, both `Promise<PermissionState>`

- [ ] **Step 1: Write the failing tests.**

`test/background-task.test.ts`:
```ts
import { setOutboxForTests } from '../src/tracking/store';
import { handleLocations, toPoint } from '../src/tracking/background-task';
import * as uploader from '../src/tracking/uploader';
import { MemoryOutbox } from './fakes/memory-outbox';

jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 } }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111') }));

const loc = (speed: number, heading: number) => ({
  coords: { latitude: 19.07, longitude: 72.87, accuracy: 22, speed, heading, altitude: 0, altitudeAccuracy: 0 },
  timestamp: Date.parse('2026-10-06T04:05:00Z'),
});

describe('background task', () => {
  let box: MemoryOutbox;
  beforeEach(() => {
    box = new MemoryOutbox();
    setOutboxForTests(box);
    jest.spyOn(uploader, 'syncNow').mockResolvedValue();
  });

  it('turns a location into a BACKGROUND point, dropping unknown (-1) speed and heading', () => {
    expect(toPoint(loc(-1, -1) as never, () => 'id-1')).toEqual({
      clientPointId: 'id-1', latitude: 19.07, longitude: 72.87, accuracyMeters: 22,
      speedMps: null, bearing: null, capturedAt: '2026-10-06T04:05:00.000Z', source: 'BACKGROUND',
    });
  });

  it('queues points for the active session and starts an upload', async () => {
    await box.setMeta('trackingSessionId', 's1');
    await handleLocations([loc(1.2, 90) as never]);
    expect(await box.count()).toBe(1);
    expect([...box.rows.values()][0]).toMatchObject({ sessionId: 's1', payload: { speedMps: 1.2, bearing: 90 } });
    expect(uploader.syncNow).toHaveBeenCalled();
  });

  it('ignores locations when no work session is running', async () => {
    await handleLocations([loc(1, 1) as never]);
    expect(await box.count()).toBe(0);
  });
});
```

`test/tracking.test.ts`:
```ts
import * as Location from 'expo-location';
import { setOutboxForTests } from '../src/tracking/store';
import { getTrackingStatus, reconcileTracking, startTracking, stopTracking } from '../src/tracking/tracking';
import { TASK_NAME } from '../src/tracking/constants';
import * as uploader from '../src/tracking/uploader';
import { MemoryOutbox } from './fakes/memory-outbox';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));
const L = Location as jest.Mocked<typeof Location>;
const perm = (granted: boolean) => ({ granted, status: granted ? 'granted' : 'denied', canAskAgain: true }) as never;

let box: MemoryOutbox;
beforeEach(() => {
  jest.resetAllMocks();
  box = new MemoryOutbox();
  setOutboxForTests(box);
  jest.spyOn(uploader, 'syncNow').mockResolvedValue();
  L.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
});

describe('tracking', () => {
  it('starts 5-minute background updates with a notification when allowed', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(true));
    await expect(startTracking('s1')).resolves.toBe('background');
    expect(L.startLocationUpdatesAsync).toHaveBeenCalledWith(TASK_NAME, expect.objectContaining({
      timeInterval: 300_000,
      foregroundService: expect.objectContaining({ notificationTitle: expect.stringContaining('at work'), killServiceOnDestroy: false }),
    }));
    expect(await box.getMeta('trackingSessionId')).toBe('s1');
  });

  it('falls back to start/end only when "Allow all the time" was refused', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(false));
    await expect(startTracking('s1')).resolves.toBe('startEndOnly');
    expect(L.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(await getTrackingStatus()).toMatchObject({ mode: 'startEndOnly' });
  });

  it('stop ends updates, forgets the session and uploads what is left', async () => {
    await box.setMeta('trackingSessionId', 's1');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await stopTracking();
    expect(L.stopLocationUpdatesAsync).toHaveBeenCalledWith(TASK_NAME);
    expect(await box.getMeta('trackingSessionId')).toBeNull();
    expect(uploader.syncNow).toHaveBeenCalled();
  });

  it('reconcile restarts tracking after the phone killed the app mid-shift', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(true));
    await reconcileTracking('s1');
    expect(L.startLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('reconcile stops tracking that outlived its session', async () => {
    await box.setMeta('trackingSessionId', 'old');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await reconcileTracking(null);
    expect(L.stopLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('status reports pending points and the last send time', async () => {
    await box.setMeta('trackingSessionId', 's1');
    await box.setMeta('lastSentAt', '2026-10-06T04:54:00.000Z');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await box.insert([{ clientPointId: 'a', sessionId: 's1', payload: { clientPointId: 'a', latitude: 1, longitude: 1, capturedAt: '2026-10-06T05:00:00Z' }, attempts: 1, nextAttemptAt: 0 }]);
    expect(await getTrackingStatus()).toEqual({ mode: 'background', pending: 1, lastSentAt: '2026-10-06T04:54:00.000Z', pendingEnd: false });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.**

`src/location/location.ts`: append
```ts
export const getBackgroundPermission = async () => toState(await Location.getBackgroundPermissionsAsync());
/** On Android 11+ this opens the system page where the person picks "Allow all the time". */
export const requestBackgroundPermission = async () => toState(await Location.requestBackgroundPermissionsAsync());
```

`src/tracking/constants.ts`:
```ts
import * as Location from 'expo-location';

export const TASK_NAME = 'worktrail-location';
export const INTERVAL_MS = 5 * 60_000;

export const TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: INTERVAL_MS,
  distanceInterval: 0,
  deferredUpdatesInterval: INTERVAL_MS,
  pausesUpdatesAutomatically: false,
  foregroundService: {
    notificationTitle: 'Work Trail: you’re at work',
    notificationBody: 'Your location is shared every 5 minutes until you tap End work.',
    notificationColor: '#FE5A0C',
    killServiceOnDestroy: false,
  },
};
```

`src/tracking/background-task.ts`:
```ts
import { randomUUID } from 'expo-crypto';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { BatchPoint } from '@worktrail/types';
import { TASK_NAME } from './constants';
import { getOutbox } from './store';
import { syncNow } from './uploader';

/** Phones report -1 for "unknown" speed and heading; store those as null. */
const known = (n: number | null | undefined) => (n != null && n >= 0 ? n : null);

export const toPoint = (loc: Location.LocationObject, uuid: () => string = randomUUID): BatchPoint => ({
  clientPointId: uuid(),
  latitude: loc.coords.latitude,
  longitude: loc.coords.longitude,
  accuracyMeters: loc.coords.accuracy ?? null,
  speedMps: known(loc.coords.speed),
  bearing: known(loc.coords.heading),
  capturedAt: new Date(loc.timestamp).toISOString(),
  source: 'BACKGROUND',
});

/** Called by Android with fresh locations, even when the app is closed. */
export async function handleLocations(locations: Location.LocationObject[]) {
  const box = await getOutbox();
  const sessionId = await box.getMeta('trackingSessionId');
  if (!sessionId || locations.length === 0) return; // never record outside a work session
  await box.insert(
    locations.map((loc) => {
      const payload = toPoint(loc);
      return { clientPointId: payload.clientPointId, sessionId, payload, attempts: 0, nextAttemptAt: 0 };
    }),
  );
  await syncNow().catch(() => undefined);
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  await handleLocations(data.locations ?? []).catch(() => undefined);
});
```

`src/tracking/tracking.ts`:
```ts
import * as Location from 'expo-location';
import { getBackgroundPermission } from '../location/location';
import { TASK_NAME, TRACKING_OPTIONS } from './constants';
import { getOutbox } from './store';
import { syncNow } from './uploader';

export type TrackingMode = 'background' | 'startEndOnly';
export type TrackingStatus = {
  mode: TrackingMode | 'off';
  pending: number;
  lastSentAt: string | null;
  pendingEnd: boolean;
};

const isRunning = () => Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);

/** Begins 5-minute background updates for a session the server has confirmed. */
export async function startTracking(sessionId: string): Promise<TrackingMode> {
  await (await getOutbox()).setMeta('trackingSessionId', sessionId);
  if ((await getBackgroundPermission()) !== 'granted') return 'startEndOnly';
  if (await isRunning()) return 'background';
  try {
    await Location.startLocationUpdatesAsync(TASK_NAME, TRACKING_OPTIONS);
    return 'background';
  } catch {
    return 'startEndOnly';
  }
}

/** Stops recording immediately (before End work is even sent) and uploads what is queued. */
export async function stopTracking(): Promise<void> {
  if (await isRunning()) await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => undefined);
  await (await getOutbox()).setMeta('trackingSessionId', null);
  void syncNow().catch(() => undefined);
}

/** Makes the phone match the server: track exactly while a session is running. */
export async function reconcileTracking(activeSessionId: string | null): Promise<void> {
  if (activeSessionId) await startTracking(activeSessionId);
  else if ((await isRunning()) || (await (await getOutbox()).getMeta('trackingSessionId'))) await stopTracking();
}

export async function getTrackingStatus(): Promise<TrackingStatus> {
  const box = await getOutbox();
  const sessionId = await box.getMeta('trackingSessionId');
  return {
    mode: !sessionId ? 'off' : (await isRunning()) ? 'background' : 'startEndOnly',
    pending: await box.count(),
    lastSentAt: await box.getMeta('lastSentAt'),
    pendingEnd: Boolean(await box.getMeta('pendingEnd')),
  };
}
```

`src/app/_layout.tsx`: make the **first line**
```ts
import '../tracking/background-task'; // Android runs this task headless; it must be defined at startup.
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): background location task with start/stop/reconcile"`

---

### Task 8: Connect tracking to start work, end work and sign out (mobile)

**Files:**
- Create: `apps/mobile/src/tracking/use-sync-triggers.ts`
- Modify: `apps/mobile/src/sessions/use-work-session.ts`, `apps/mobile/src/auth/auth-store.ts`, `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/test/screens/home.test.tsx`, `apps/mobile/test/auth-store.test.ts`

**Interfaces:**
- Consumes: `startTracking`, `stopTracking`, `reconcileTracking`, `syncNow`, `savePendingEnd`, `readPendingEnd`, `clearPendingEnd`, `getOutbox`.
- Produces:
  - `ActiveView` gains `pendingEnd?: boolean` and `mode?: TrackingMode`
  - `useWorkSession().lastStartMode`
  - `useSyncTriggers()`

- [ ] **Step 1: Write the failing tests.** In `test/screens/home.test.tsx`:
  - Add `jest.mock('../../src/tracking/tracking')` and `jest.mock('../../src/tracking/uploader')` at the top.
  - Call `setOutboxForTests(new MemoryOutbox())` in `beforeEach`.
  - Make the mocked `startTracking` resolve `'background'`.
  - Update the "ends work after confirming" test to expect the request body to include `endedAt`.
  - Add:
```tsx
  it('ending work with no signal ends it now and promises to send it later', async () => {
    const started = new Date(Date.now() - 30 * 60_000).toISOString();
    fetchMock
      .mockReturnValueOnce(json({ session: session(started), serverTime: new Date().toISOString() }))
      .mockRejectedValueOnce(new TypeError('Network request failed'));
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'NO_FIX' });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'End work')?.onPress?.());
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'End work' }));
    expect(await screen.findByText('Work ended. We’ll send it to your company when you’re back online.')).toBeOnTheScreen();
    expect(tracking.stopTracking).toHaveBeenCalled();
    expect(await readPendingEnd()).toMatchObject({ sessionId: 's1' });
  });

  it('a queued end keeps the screen off duty even though the server still says at work', async () => {
    await savePendingEnd({ sessionId: 's1', body: { deviceTime: new Date().toISOString() } });
    fetchMock.mockReturnValue(json({ session: session(new Date().toISOString()), serverTime: new Date().toISOString() }));
    renderHome();
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
  });

  it('starting work starts background tracking for the new session', async () => {
    fetchMock
      .mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }))
      .mockReturnValueOnce(json({ session: session(new Date().toISOString()), serverTime: new Date().toISOString() }, 201));
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(tracking.startTracking).toHaveBeenCalledWith('s1'));
  });
```
(with `import * as tracking from '../../src/tracking/tracking'`, `savePendingEnd`/`readPendingEnd` from `pending-end`, `setOutboxForTests`, and `MemoryOutbox`).

In `test/auth-store.test.ts` add:
```ts
  it('sign out stops tracking, tries a last upload and wipes the phone queue', async () => {
    const box = new MemoryOutbox();
    setOutboxForTests(box);
    await box.insert([{ clientPointId: 'a', sessionId: 's', payload: { clientPointId: 'a', latitude: 1, longitude: 1, capturedAt: '2026-10-06T05:00:00Z' }, attempts: 0, nextAttemptAt: 0 }]);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await useAuthStore.getState().signOut();
    expect(tracking.stopTracking).toHaveBeenCalled();
    expect(await box.count()).toBe(0);
  });
```
(mock `../src/tracking/tracking` and `../src/tracking/uploader` in that file too). Run → FAIL.

- [ ] **Step 2: Implement.** `src/sessions/use-work-session.ts` changes (replacing the Phase 2 versions of `fetchActive`, `start` and `end`):
```ts
import { reconcileTracking, startTracking, stopTracking, type TrackingMode } from '../tracking/tracking';
import { clearPendingEnd, readPendingEnd, savePendingEnd } from '../tracking/pending-end';
import { syncNow } from '../tracking/uploader';

type ActiveView = { session: WorkSessionDto | null; offsetMs: number; pendingEnd?: boolean };

async function fetchActive(): Promise<ActiveView> {
  const view = toView(await api.request<ActiveSessionResponse>('GET', '/sessions/me/active'));
  const pending = await readPendingEnd();
  if (pending && view.session?.id === pending.sessionId) {
    // The end is queued but not delivered yet: the employee has already stopped work.
    void syncNow();
    return { ...view, session: null, pendingEnd: true };
  }
  if (pending) await clearPendingEnd(); // server already shows it ended
  await reconcileTracking(view.session?.id ?? null).catch(() => undefined);
  return view;
}
```
In the `start` mutation, after a successful start (and in the `SESSION_ALREADY_ACTIVE` branch), call `const mode = await startTracking(view.session!.id)`, store it with `setLastStartMode(mode)` (a new `useState<TrackingMode | null>`), and return the view.

Replace the `end` mutation's `mutationFn` with:
```ts
    mutationFn: async (sessionId: string): Promise<ActiveView> => {
      await stopTracking(); // stop recording the moment End is tapped
      const offsetMs = qc.getQueryData<ActiveView>(ACTIVE_SESSION_KEY)?.offsetMs ?? 0;
      const fix = await currentFix(5_000);
      const body = {
        deviceTime: new Date().toISOString(),
        endedAt: new Date(Date.now() + offsetMs).toISOString(),
        finalLocation: fix.ok ? fix.fix : undefined,
      };
      try {
        await api.request<SessionMutationResponse>('POST', `/sessions/${sessionId}/end`, body);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NETWORK') {
          await savePendingEnd({ sessionId, body });
          return { session: null, offsetMs, pendingEnd: true };
        }
        if (!(e instanceof ApiError && e.code === 'SESSION_NOT_ACTIVE')) throw e;
      }
      void syncNow();
      return fetchActive();
    },
```
Return `pendingEnd: active.data?.pendingEnd ?? false` and `lastStartMode` from the hook.

`src/tracking/use-sync-triggers.ts`:
```ts
import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncNow } from './uploader';

/** Upload queued points when the app comes back and when the connection returns. */
export function useSyncTriggers() {
  useEffect(() => {
    void syncNow().catch(() => undefined);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow().catch(() => undefined);
    });
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void syncNow().catch(() => undefined);
    });
    return () => {
      app.remove();
      net();
    };
  }, []);
}
```
Call `useSyncTriggers()` at the top of `src/app/(app)/_layout.tsx`'s component.

`src/auth/auth-store.ts` `signOut()`: before the existing logout request, add
```ts
      await stopTracking().catch(() => undefined);
      await syncNow().catch(() => undefined); // last chance to deliver this person's points
      await (await getOutbox()).clear(); // the next person on this phone never inherits them
```
(imports `stopTracking`, `syncNow`, `getOutbox`; the cycle is call-time only, as in Phase 2).

In `src/app/(app)/index.tsx`, render `{work.pendingEnd ? <Notice>Work ended. We’ll send it to your company when you’re back online.</Notice> : null}` in the off-duty branch.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): tracking follows the work session; offline End work; sync triggers; private sign out"`

---

### Task 9: Tracking status, "Allow all the time" step and battery tip (mobile)

**Files:**
- Create: `apps/mobile/src/components/TrackingStatus.tsx`, `apps/mobile/src/tracking/battery.ts`, `apps/mobile/test/screens/tracking-status.test.tsx`
- Modify: `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/src/app/(app)/permissions.tsx`

**Interfaces:**
- Produces:
  - `<TrackingStatus />` (reads `getTrackingStatus()` every 15 s, and right after start or end)
  - `openBatterySettings()`
  - `shouldShowBatteryTip()` and `dismissBatteryTip()`
  - `/permissions?step=background`

- [ ] **Step 1: Write the failing test.** `test/screens/tracking-status.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrackingStatus } from '../../src/components/TrackingStatus';
import * as tracking from '../../src/tracking/tracking';

jest.mock('../../src/tracking/tracking');
const status = tracking.getTrackingStatus as jest.Mock;

const renderIt = () =>
  render(<QueryClientProvider client={new QueryClient()}><TrackingStatus timezone="Asia/Kolkata" /></QueryClientProvider>);

describe('TrackingStatus', () => {
  it('says how often location is shared and when it last went', async () => {
    status.mockResolvedValue({ mode: 'background', pending: 0, lastSentAt: '2026-10-06T04:54:00.000Z', pendingEnd: false });
    renderIt();
    expect(await screen.findByText('Location shared every 5 minutes · last sent 10:24 AM')).toBeOnTheScreen();
  });

  it('shows what is waiting while offline', async () => {
    status.mockResolvedValue({ mode: 'background', pending: 3, lastSentAt: null, pendingEnd: false });
    renderIt();
    expect(await screen.findByText('3 locations waiting to send. They’ll go when you’re back online.')).toBeOnTheScreen();
  });

  it('is honest when background location is off, and offers the fix', async () => {
    status.mockResolvedValue({ mode: 'startEndOnly', pending: 0, lastSentAt: null, pendingEnd: false });
    renderIt();
    expect(await screen.findByText('Background location is off, so only your start and end locations are recorded.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Turn it on' })).toBeOnTheScreen();
  });

  it('shows nothing when off duty', async () => {
    status.mockResolvedValue({ mode: 'off', pending: 0, lastSentAt: null, pendingEnd: false });
    renderIt();
    expect(screen.queryByText(/Location shared/)).toBeNull();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.**

`src/components/TrackingStatus.tsx`:
```tsx
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { timeLabel } from '../sessions/session-logic';
import { getTrackingStatus } from '../tracking/tracking';
import { colors, fonts } from '../theme/theme';
import { Notice } from './Notice';

export const TRACKING_STATUS_KEY = ['tracking', 'status'] as const;

export function TrackingStatus({ timezone }: { timezone: string }) {
  const router = useRouter();
  const { data } = useQuery({ queryKey: TRACKING_STATUS_KEY, queryFn: getTrackingStatus, refetchInterval: 15_000 });
  if (!data || data.mode === 'off') return null;

  if (data.mode === 'startEndOnly') {
    return (
      <Notice tone="warning">
        Background location is off, so only your start and end locations are recorded.{' '}
        <Text accessibilityRole="link" style={{ fontFamily: fonts.semibold, color: colors.brand700 }} onPress={() => router.push('/permissions?step=background')}>
          Turn it on
        </Text>
      </Notice>
    );
  }
  if (data.pending > 0) {
    return <Notice>{`${data.pending} location${data.pending === 1 ? '' : 's'} waiting to send. They’ll go when you’re back online.`}</Notice>;
  }
  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink500 }}>
      {data.lastSentAt
        ? `Location shared every 5 minutes · last sent ${timeLabel(data.lastSentAt, timezone)}`
        : 'Location shared every 5 minutes'}
    </Text>
  );
}
```

`src/tracking/battery.ts`:
```ts
import * as IntentLauncher from 'expo-intent-launcher';
import { getOutbox } from './store';

/** Many Android phones stop background apps to save battery; this opens the page to exempt Work Trail. */
export const openBatterySettings = () =>
  IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS).catch(() => undefined);

export const shouldShowBatteryTip = async () => !(await (await getOutbox()).getMeta('batteryTipShown'));
export const dismissBatteryTip = async () => (await getOutbox()).setMeta('batteryTipShown', '1');
```

`src/app/(app)/index.tsx`:
- Render `<TrackingStatus timezone={TZ} />` inside the at-work card, under the "Location recorded at…" line, and invalidate `TRACKING_STATUS_KEY` after start and end.
- After a successful start, if `work.lastStartMode === 'startEndOnly'` and the `askedBackground` meta isn't set, set it and `router.push('/permissions?step=background')`. This asks once and never nags.
- If `lastStartMode === 'background'` and `shouldShowBatteryTip()`, show:
```tsx
<Notice>
  Some phones stop apps in the background to save battery. To keep your work day recorded, let Work Trail run in the background.
</Notice>
<Button title="Open battery settings" variant="secondary" onPress={() => void openBatterySettings().then(dismissBatteryTip)} />
<Text accessibilityRole="button" onPress={() => void dismissBatteryTip()}>Not now</Text>
```
(keep the tip in local state so it hides immediately).

`src/app/(app)/permissions.tsx`:
- Read `const { step } = useLocalSearchParams<{ step?: string }>()`.
- When `step === 'background'`, show the title **"Keep recording while your screen is off"** and these points:
  - "Choose **Allow all the time** on the next screen."
  - "Work Trail then records your location about every 5 minutes while you're at work, even when the phone is locked."
  - "Nothing is recorded after you tap End work, and you'll always see a notification while it's on."
- The button **"Continue"** calls `requestBackgroundPermission()`. On `granted` → `router.back()`. Otherwise show the same Settings fallback as the foreground step.
- Add a test case to `test/screens/permissions.test.tsx` (new file) that renders with `step: 'background'`, presses Continue with a mocked `requestBackgroundPermission` resolving `'blocked'`, and expects the "Open settings" button.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): tracking status, background permission step and battery tip"`

---

### Task 10: Test on a real phone and record the results

**Files:**
- Create: `docs/device-test-android.md` (checklist + results)
- On any failure: a failing test in the owning task's file, the fix, and a `fix(...)` commit.

- [ ] **Step 1: Build and run.** Use the memory-safe order from Task 4 Step 5:
  1. Build and install.
  2. Then `pnpm db:up`, start the API from `dist`, and start the website with `next start`.
  3. Set `EXPO_PUBLIC_API_URL` to the PC's LAN IP.
  4. Sign in as `amit@demo.worktrail.in`.

- [ ] **Step 2: Run the checklist and record every result.** Create `docs/device-test-android.md` from this template and fill in the "Observed" column:

```markdown
# Android background location — device test

Phone: <brand model> · Android <version> · Battery saver at start: <on/off> · Date: <YYYY-MM-DD>
App build: <commit sha> · API: <LAN IP>

| # | Scenario | Expected | Observed |
|---|---|---|---|
| 1 | Start work; grant "while using" then "Allow all the time" | Notification "Work Trail: you're at work" appears; Home says "Location shared every 5 minutes" | |
| 2 | Lock screen 30 min, phone still | ~6 points in DB for the session (`select count(*) from location_points where session_id=…`) | |
| 3 | Walk/drive 30 min with screen locked | ~6 points along the route; dashboard pin moves | |
| 4 | Swipe the app away from Recents for 15 min | Notification stays; ~3 more points arrive | |
| 5 | Airplane mode 20 min, then off | Home shows "N locations waiting to send"; after reconnect all arrive once (no duplicate client_point_id) | |
| 6 | End work in airplane mode, wait 10 min, reconnect | Notification disappears immediately; "Work ended. We'll send it…"; after reconnect the session's ended_at_server ≈ tap time, total_minutes correct | |
| 7 | Battery saver ON for 30 min while at work | Record what the OS does (points may thin out); tip's "Open battery settings" opens the right page | |
| 8 | Reboot the phone mid-shift, then open the app | Home shows At work; tracking resumes (notification back); points continue | |
| 9 | Refuse "Allow all the time" on a fresh install | Start/End still work; Home warns "Background location is off…" with "Turn it on" | |
| 10 | Sign out while at work | "End work and sign out" ends the session; notification gone; outbox empty | |
| 11 | Battery use over a 4-hour session | Settings → Battery → Work Trail %: record it | |

Notes on OS behaviour (doze, OEM battery managers, delays):
```

The database checks run with:
```bash
docker compose exec -T postgres psql -U worktrail -c "select source, quality_flag, count(*), min(captured_at), max(captured_at) from location_points where captured_at > now() - interval '6 hours' group by 1,2;"
docker compose exec -T postgres psql -U worktrail -c "select count(*) - count(distinct (employee_id, client_point_id)) as duplicates from location_points;"
```
Expected: `duplicates` = 0.

- [ ] **Step 3: Build a shareable APK.** Run `pnpm --filter @worktrail/mobile android:apk`, then install `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` on a second phone. Repeat rows 1, 5 and 6 on it.

- [ ] **Step 4: Run the full suite.** Run `pnpm test`. Expected: every workspace passes. Commit `docs/device-test-android.md` with `git commit -m "docs: Android background location device test results"`.

---

## Open Questions (each has a default; tell me if any is wrong)

1. **How the app is built and shared.** *Default: built on this PC (Android SDK already installed), with a release APK shared directly (WhatsApp or Drive) for testing.* If you'd rather use Expo's cloud builds (EAS), you'll need a free Expo account and to share its login once.
2. **Play Store background-location policy.** Google requires a declaration form and a video showing the in-app disclosure before an app with "Allow all the time" can be published. *Default: handled in Phase 7. The disclosure screens built here are designed to satisfy it.*
3. **Tracking interval.** *Default: every 5 minutes (PRD target), with Balanced accuracy for battery.* Shorter intervals drain more battery.
4. **What happens if the employee refuses "Allow all the time".** *Default: work sessions still work with start and end points only, plus a visible warning with a fix.* The alternative is to block Start work until it's granted, which is stricter but may make employees resist the app.
5. **Retention on the phone.** *Default: queued points stay until uploaded (no age limit) and are wiped on sign-out.* Should points older than, say, 7 days be dropped if a phone stays offline that long?
6. **Battery tip.** *Default: shown once after the first background start, with a button to Android's battery settings.* Should it also show the brand-specific steps for Xiaomi, Oppo and Vivo?
