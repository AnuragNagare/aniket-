# Work Trail Phase 2: Employee Android App and Work Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first version of the Work Trail employee app for Android. An employee joins with their invite link or signs in, then taps Start work and End work. Each tap records a work session on the server with one location point at the start and one at the end. The admin dashboard shows them as "Working now" in real time.

**Architecture:**
- A new Expo app in `apps/mobile`: Expo SDK 57, Expo Router, TypeScript, Zustand for sign-in state, and TanStack Query for server data. It uses the same design tokens (`@worktrail/ui`) and validation schemas (`@worktrail/types`) as the website.
- The API gets a `sessions` module (start, end, active session) and a `me` module (the signed-in person's profile), in the same folder layout as the existing API code.
- The app keeps the refresh token in Android's encrypted storage (`expo-secure-store`) and the short-lived access token in memory only. When several requests hit an expired token at once, a single shared refresh renews it.
- Location is captured once at Start and once at End, while the app is open. Recording location every 5 minutes in the background is Phase 3.

**Tech Stack:**
- API (unchanged stack): NestJS 12 + Prisma 6 + PostgreSQL.
- App: Expo SDK 57 + Expo Router 57, React Native, `expo-secure-store`, `expo-location`, `expo-crypto`, `expo-battery`, `expo-linear-gradient`, `react-native-svg`, `@tanstack/react-query` 5, `zustand` 5, `@expo-google-fonts/barlow` + `barlow-semi-condensed`, and `date-fns-tz`.
- Tests: Vitest + supertest for the API, `jest-expo` + `@testing-library/react-native` for the app.

**Spec:**
- `docs/specs/prd.pdf`: §3 "Employee workday" steps 1–3 and 8, §4 "Work session", §5 employee app screens, §7 privacy.
- `docs/specs/api-contract.pdf`: "Sessions" (`POST /sessions/start`, `POST /sessions/:sessionId/end`, `GET /sessions/me/active`).
- `docs/specs/data-model.pdf`: `work_sessions`, `location_points`.
- `docs/specs/Landing page.png`: the welcome screen.
- `plan.md`: Design System, Global Constraints, Phase 2 outline.

---

## What we're building (plain summary)

**Employee app screens**

| Screen | What the employee sees and does |
|---|---|
| Welcome | Matches `Landing page.png`: app icon, "Work Trail", "Track work. Share updates. Get clear reports.", the day-trail illustration, and three value tiles. **Get started** opens Join and **Sign in** opens Login. |
| Join your company | Paste the invite link from WhatsApp or email (or open a `worktrail://invite/<token>` link). The screen shows which company invited them, they set a password, and they're signed in. |
| Sign in | Email and password. "Forgot password?" opens the website's reset page. Admin accounts are told to use the website. |
| Location permission | Plain-language disclosure before Android asks for permission: what's recorded, when, why, who sees it, and how to stop. Then **Allow location**, or **Open settings** if permission was blocked. |
| Home (off duty) | "Ready to start your day?" with a **Start work** button. |
| Home (at work) | A live timer, start time and last location time, and an **End work** button. If a session was left running from an earlier day, a banner offers to end it. |
| Profile | Name, email, designation, company, and a privacy note. **Sign out** offers to end work first if a session is running. |

**API additions**
- `POST /api/v1/sessions/start`: starts one session for the employee and stores the START location point if one was sent. A second start returns the session that's already running (409), so tapping twice or retrying is safe.
- `POST /api/v1/sessions/:id/end`: ends the session, stores the END point and works out the total minutes from server time.
- `GET /api/v1/sessions/me/active`: the running session (or `null`) plus the server time, so the app's timer is right even if the phone's clock is wrong.
- `GET /api/v1/me`: the signed-in person, their employee record and their company, for the Profile screen.

**Not in Phase 2:** background location every 5 minutes and offline queueing (Phase 3), work updates and voice (Phase 4), history (Phase 4), and the Play Store release (Phase 7).

---

## Files to create and change

### Changed files

| File | What changes |
|---|---|
| `packages/types/src/index.ts` | Export the new `sessions.ts` and `profile.ts`. |
| `apps/api/src/app.module.ts` | Import `SessionsModule` and `MeModule`. |
| `apps/api/test/helpers/auth.ts` | Add `employeeAs(app, prisma, companyId?)`, which creates an EMPLOYEE user with a linked employee record and returns their access token. |
| `.env.example` | Add `EXPO_PUBLIC_API_URL=http://192.168.1.108:4000` with a comment: the address of the computer running the API, as seen from the phone. |
| `.gitignore` | Add `apps/mobile/.env` and `apps/mobile/android/` (generated by dev builds in Phase 3). |
| `pnpm-workspace.yaml` | Allow install scripts for any new native packages that `pnpm install` reports under "Ignored build scripts". |
| `docs/specs` | Unchanged. The welcome illustration is cropped from `Landing page.png` into `apps/mobile/assets/`. |

No website changes are needed. The dashboard's "Working now" and "Today's work hours" already read `work_sessions`, so they show app-started sessions automatically.

### New files

```
packages/types/src/sessions.ts          LocationFixSchema, Start/EndSessionSchema, WorkSessionDto, responses
packages/types/src/profile.ts           MeResponse
packages/types/test/sessions.test.ts

apps/api/src/common/utils/location-quality.ts           qualityFor(accuracy, capturedAt, now)
apps/api/src/modules/sessions/sessions.module.ts
apps/api/src/modules/sessions/controllers/sessions.controller.ts
apps/api/src/modules/sessions/services/sessions.service.ts
apps/api/src/modules/me/me.module.ts
apps/api/src/modules/me/controllers/me.controller.ts
apps/api/src/modules/me/services/me.service.ts
apps/api/test/unit/location-quality.spec.ts
apps/api/test/e2e/sessions.e2e-spec.ts
apps/api/test/e2e/me.e2e-spec.ts

apps/mobile/                                   created by create-expo-app, then:
  app.json                                     name, Android package, plugins, permission text
  package.json                                 scripts, jest config, workspace deps
  .env.example                                 EXPO_PUBLIC_API_URL
  assets/welcome-trail.png                     cropped from Landing page.png
  src/config.ts                                API_URL
  src/theme/theme.ts                           colors, fonts, radius from @worktrail/ui
  src/api/client.ts                            fetch client: error envelope, single-flight refresh
  src/api/index.ts                             the app's api instance (wired to the auth store)
  src/auth/token-storage.ts                    refresh token in SecureStore
  src/auth/auth-store.ts                       Zustand: status, user, signIn, acceptInvite, signOut
  src/auth/invite-token.ts                     extractInviteToken(text)
  src/location/location.ts                     permission state + one-off location fix
  src/sessions/session-logic.ts                formatElapsed, elapsedMs, isStale, timeLabel
  src/sessions/use-work-session.ts             TanStack Query hook: active, start, end
  src/hooks/use-now.ts                         ticking clock
  src/components/{Screen,Button,TextField,Logo,StatusPill,Notice}.tsx
  src/app/_layout.tsx                          fonts, providers, auth gate (Stack.Protected)
  src/app/offline.tsx                          "Can't reach Work Trail" + Try again
  src/app/(auth)/_layout.tsx
  src/app/(auth)/welcome.tsx
  src/app/(auth)/login.tsx
  src/app/(auth)/join.tsx
  src/app/(app)/_layout.tsx
  src/app/(app)/index.tsx                      home (off duty / at work)
  src/app/(app)/permissions.tsx                location disclosure
  src/app/(app)/profile.tsx
  test/setup.ts                                SecureStore mock, wires the expo-router mock
  test/mocks/expo-router.ts                    shared mockRouter
  test/api-client.test.ts
  test/auth-store.test.ts
  test/invite-token.test.ts
  test/session-logic.test.ts
  test/location.test.ts
  test/screens/login.test.tsx
  test/screens/join.test.tsx
  test/screens/home.test.tsx
  test/screens/profile.test.tsx
```

---

## Global Constraints

- Everything in `plan.md` → Global Constraints still applies:
  - Company scoping, with another company's id returning 404.
  - The error envelope, `/api/v1`, and argon2id for passwords.
  - Sentence-case copy.
  - No secrets in the repo.
- "One active session maximum per employee" (PRD §4). This is already enforced by the database's partial unique index. The API returns the existing session on a second start.
- "Start work stores started_at using server time and device time, and triggers immediate location capture." "End work stores ended_at, final location attempt, and calculated duration" (PRD §4). The duration comes from **server** times.
- "Tracking is permitted only when an employee has an active work session" (PRD §4). The app reads location only while Start or End is in progress.
- "Employee must see a clear disclosure before tracking starts: what is collected, when it is collected, why, who can view it, and how to stop it" (PRD §7). This is the permission screen in Task 7.
- "Reject clearly invalid coordinates and retain poor-accuracy records with an accuracy flag rather than silently claiming precision" (PRD §4). The rules:
  - `accuracyMeters > 100` or missing → `LOW_ACCURACY`.
  - `capturedAt` more than 5 minutes in the future → `SUSPICIOUS`.
  - Latitude/longitude out of range → 400.
- "Do not claim continuous real-time tracking in v1." The app never says "live". It says "Location recorded at start and end of work" until Phase 3 adds pings.
- Android 10+ is the target, and Android is the only platform tested. App id `in.worktrail.app`, scheme `worktrail`.
- `/sessions/*` endpoints are EMPLOYEE-only. OWNER/ADMIN accounts are refused by the API (403) and by the app ("This app is for field employees…").
- App code layout is `src/app` (routes only), `src/<feature>/` for logic and `src/components/` for shared UI. Screens hold no fetch code; they call hooks and stores.
- Look and feel follows `plan.md` → Design System: canvas `#FBF8F5`, white cards, orange CTA gradient `#FF7A2E → #E84A00`, Barlow/Barlow Semi Condensed, 12px inputs and buttons, 16px cards.
- Memory is limited on this machine. Run the API from its build (`node dist/main.js`) and the website from `next start`. Never run `next dev` and Metro at the same time.

## Review Focus

1. **Several requests find the access token expired at once** (for example when the app comes back after 15+ minutes). Exactly one refresh happens, every request is retried with the new token, and the employee stays signed in. Refresh tokens rotate, so two parallel refreshes would trip reuse detection and sign them out everywhere. Test in Task 5.
2. **Start work tapped twice, or retried after a timeout.** One session exists. The second tap shows the running session, not an error. Tests in Task 2 (API: sequential and concurrent) and Task 8 (app handles the 409 by resuming).
3. **No location fix:** permission denied, GPS off, or indoors with no fix.
   - Denied: the app opens the disclosure screen.
   - GPS off: a clear "Turn on location" message.
   - No fix within 10 s: work still starts, and the screen says the start location wasn't recorded.
   Tests in Task 7 and Task 8.
4. **A session left running overnight because the app was killed.** On the next launch, home shows "You started work yesterday at 9:02 AM and haven't ended it" with **End work** and **Keep working**. Total minutes come from server times even if the phone's clock is wrong. Tests in Task 2 (server duration) and Task 8 (stale banner, server-offset timer).
5. **An admin signs in on the app, or an employee is disabled while signed in.** Admins see "This app is for field employees. Company admins sign in on the Work Trail website." and nothing is stored. A disabled employee is signed out at the next refresh. Tests in Task 5 and Task 6.

---

### Task 1: Shared types for sessions and the profile

**Files:**
- Create: `packages/types/src/sessions.ts`, `packages/types/src/profile.ts`, `packages/types/test/sessions.test.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces:
  - `LocationFixSchema` / `LocationFix { clientPointId: string(uuid); latitude; longitude; accuracyMeters?: number|null; capturedAt: ISO string; batteryLevel?: number|null }`
  - `StartSessionSchema` / `StartSessionInput { deviceTime; initialLocation?: LocationFix }`
  - `EndSessionSchema` / `EndSessionInput { deviceTime; finalLocation?: LocationFix }`
  - `SessionStatus = 'ACTIVE'|'COMPLETED'|'INCOMPLETE'`
  - `WorkSessionDto { id; status; startedAt; endedAt: string|null; totalMinutes: number|null; lastLocationAt: string|null }`
  - `ActiveSessionResponse { session: WorkSessionDto|null; serverTime }`
  - `SessionMutationResponse { session: WorkSessionDto; serverTime }`
  - `MeResponse { user: AuthUser; employee: { id; name; designation; employeeCode; phone } | null; company: { name; timezone } }`

- [ ] **Step 1: Write the failing test.** `packages/types/test/sessions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EndSessionSchema, LocationFixSchema, StartSessionSchema } from '../src/index.js';

const fix = {
  clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
  latitude: 19.076,
  longitude: 72.8777,
  accuracyMeters: 18,
  capturedAt: '2026-10-05T03:30:05.000Z',
  batteryLevel: 0.72,
};

describe('session schemas', () => {
  it('accepts a start with or without a location', () => {
    expect(StartSessionSchema.safeParse({ deviceTime: '2026-10-05T03:30:00.000Z', initialLocation: fix }).success).toBe(true);
    expect(StartSessionSchema.safeParse({ deviceTime: '2026-10-05T03:30:00.000Z' }).success).toBe(true);
  });

  it('rejects impossible coordinates with a readable message', () => {
    const r = LocationFixSchema.safeParse({ ...fix, latitude: 95 });
    expect(r.error?.issues[0]?.message).toBe('Latitude must be between -90 and 90.');
  });

  it('requires a uuid client point id so retries can be de-duplicated', () => {
    expect(LocationFixSchema.safeParse({ ...fix, clientPointId: 'abc' }).success).toBe(false);
  });

  it('allows unknown accuracy and battery', () => {
    expect(LocationFixSchema.safeParse({ ...fix, accuracyMeters: null, batteryLevel: null }).success).toBe(true);
  });

  it('EndSessionSchema requires deviceTime', () => {
    expect(EndSessionSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `pnpm --filter @worktrail/types test` → FAIL (`StartSessionSchema` not exported).

- [ ] **Step 3: Implement.** `packages/types/src/sessions.ts`:
```ts
import { z } from 'zod';

export const LocationFixSchema = z.object({
  /** Generated on the phone; the API ignores a point it has already stored with this id. */
  clientPointId: z.string().uuid(),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90.').max(90, 'Latitude must be between -90 and 90.'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180.').max(180, 'Longitude must be between -180 and 180.'),
  accuracyMeters: z.number().min(0).max(100_000).nullable().optional(),
  capturedAt: z.string().datetime(),
  batteryLevel: z.number().min(0).max(1).nullable().optional(),
});
export type LocationFix = z.output<typeof LocationFixSchema>;

export const StartSessionSchema = z.object({
  deviceTime: z.string().datetime(),
  initialLocation: LocationFixSchema.optional(),
});
export type StartSessionInput = z.output<typeof StartSessionSchema>;

export const EndSessionSchema = z.object({
  deviceTime: z.string().datetime(),
  finalLocation: LocationFixSchema.optional(),
});
export type EndSessionInput = z.output<typeof EndSessionSchema>;

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'INCOMPLETE';

export type WorkSessionDto = {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  totalMinutes: number | null;
  lastLocationAt: string | null;
};

/** serverTime lets the app correct for a wrong phone clock. */
export type ActiveSessionResponse = { session: WorkSessionDto | null; serverTime: string };
export type SessionMutationResponse = { session: WorkSessionDto; serverTime: string };
```

`packages/types/src/profile.ts`:
```ts
import type { AuthUser } from './auth.js';

export type MeResponse = {
  user: AuthUser;
  employee: {
    id: string;
    name: string;
    designation: string | null;
    employeeCode: string | null;
    phone: string | null;
  } | null;
  company: { name: string; timezone: string };
};
```
Append to `index.ts`: `export * from './sessions.js';` and `export * from './profile.js';`.

- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build` → PASS (27 tests).

- [ ] **Step 5: Commit.** `git add packages/types && git commit -m "feat(types): work session and profile contracts"`

---

### Task 2: Sessions API (start, end, active)

**Files:**
- Create: `apps/api/src/common/utils/location-quality.ts`, `apps/api/src/modules/sessions/{sessions.module.ts,controllers/sessions.controller.ts,services/sessions.service.ts}`, `apps/api/test/unit/location-quality.spec.ts`, `apps/api/test/e2e/sessions.e2e-spec.ts`
- Modify: `apps/api/test/helpers/auth.ts` (add `employeeAs`), `apps/api/src/app.module.ts` (import `SessionsModule`)

**Interfaces:**
- Consumes: Task 1 types; `AuthContext`, `@Roles`, `@CurrentAuth`, `ZodBody`, `AppError`, `PrismaService`.
- Produces:
  - `qualityFor(accuracyMeters: number | null | undefined, capturedAt: Date, now?: Date): QualityFlag`
  - `GET /sessions/me/active` → `ActiveSessionResponse`
  - `POST /sessions/start` → 201 `SessionMutationResponse`, or 409 `SESSION_ALREADY_ACTIVE` with `details.session: WorkSessionDto`
  - `POST /sessions/:sessionId/end` → 200 `SessionMutationResponse`, 404 `NOT_FOUND`, or 409 `SESSION_NOT_ACTIVE`
  - All three return 403 `FORBIDDEN` for OWNER/ADMIN, and 403 `NOT_AN_EMPLOYEE` for an EMPLOYEE user with no employee record.
  - Test helper `employeeAs(app, prisma, companyId?) → { token, user, employee }`

- [ ] **Step 1: Write the failing unit test.** `apps/api/test/unit/location-quality.spec.ts`:
```ts
import { qualityFor } from '../../src/common/utils/location-quality.js';

const now = new Date('2026-10-05T04:00:00Z');

describe('qualityFor', () => {
  it('is GOOD for an accurate, current fix', () => {
    expect(qualityFor(18, new Date('2026-10-05T03:59:00Z'), now)).toBe('GOOD');
  });
  it('is LOW_ACCURACY when accuracy is worse than 100 m or unknown', () => {
    expect(qualityFor(250, now, now)).toBe('LOW_ACCURACY');
    expect(qualityFor(null, now, now)).toBe('LOW_ACCURACY');
  });
  it('is SUSPICIOUS when the phone says the fix is from the future', () => {
    expect(qualityFor(10, new Date('2026-10-05T04:06:00Z'), now)).toBe('SUSPICIOUS');
  });
});
```
Run `cd apps/api && pnpm test:unit` → FAIL (module not found).

- [ ] **Step 2: Implement the helper.** `src/common/utils/location-quality.ts`:
```ts
import type { QualityFlag } from '@prisma/client';

const MAX_GOOD_ACCURACY_M = 100;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

/** Flags doubtful points instead of dropping them (PRD: "do not overstate accuracy"). */
export function qualityFor(
  accuracyMeters: number | null | undefined,
  capturedAt: Date,
  now = new Date(),
): QualityFlag {
  if (capturedAt.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS) return 'SUSPICIOUS';
  if (accuracyMeters == null || accuracyMeters > MAX_GOOD_ACCURACY_M) return 'LOW_ACCURACY';
  return 'GOOD';
}
```
Run `pnpm test:unit` → PASS.

- [ ] **Step 3: Add the employee test helper.** Append to `apps/api/test/helpers/auth.ts`:
```ts
import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';

/** Creates an EMPLOYEE user with a linked employee record and signs them in. */
export async function employeeAs(app: INestApplication, prisma: PrismaClient, companyId?: string) {
  n += 1;
  const cid = companyId ?? (await signupAs(app)).user.companyId;
  const email = `emp${n}@field${n}.in`;
  const passwordHash = await argon2.hash('StrongPass1', { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { companyId: cid, role: 'EMPLOYEE', name: `Field ${n}`, email, passwordHash },
  });
  const employee = await prisma.employee.create({
    data: { companyId: cid, userId: user.id, name: `Field ${n}`, email },
  });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: 'StrongPass1' })
    .expect(200);
  const body = res.body as AuthTokens;
  return { token: body.accessToken, user: body.user, employee };
}
```
(Move the new imports to the top of the file next to the existing ones.)

- [ ] **Step 4: Write the failing e2e test.** `apps/api/test/e2e/sessions.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const fix = (over: Record<string, unknown> = {}) => ({
  clientPointId: randomUUID(),
  latitude: 19.076,
  longitude: 72.8777,
  accuracyMeters: 18,
  capturedAt: new Date().toISOString(),
  batteryLevel: 0.7,
  ...over,
});

describe('work sessions', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const start = (token: string, body: object = { deviceTime: new Date().toISOString(), initialLocation: fix() }) =>
    http().post('/api/v1/sessions/start').set('Authorization', `Bearer ${token}`).send(body);
  const end = (token: string, id: string, body: object = { deviceTime: new Date().toISOString(), finalLocation: fix() }) =>
    http().post(`/api/v1/sessions/${id}/end`).set('Authorization', `Bearer ${token}`).send(body);
  const active = (token: string) =>
    http().get('/api/v1/sessions/me/active').set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('start creates one ACTIVE session with a START point and returns server time', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token).expect(201);
    expect(res.body.session).toMatchObject({ status: 'ACTIVE', endedAt: null, totalMinutes: null });
    expect(res.body.session.lastLocationAt).toEqual(expect.any(String));
    expect(Date.parse(res.body.serverTime)).toBeGreaterThan(Date.now() - 10_000);
    const points = await prisma.locationPoint.findMany({ where: { sessionId: res.body.session.id } });
    expect(points).toEqual([expect.objectContaining({ source: 'START', qualityFlag: 'GOOD' })]);
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: res.body.session.id } });
    expect(row.startedAtDevice).not.toBeNull();
  });

  it('a second start returns the running session instead of creating another', async () => {
    const e = await employeeAs(app, prisma);
    const first = await start(e.token).expect(201);
    const second = await start(e.token).expect(409);
    expect(second.body.error.code).toBe('SESSION_ALREADY_ACTIVE');
    expect(second.body.error.details.session.id).toBe(first.body.session.id);
    expect(await prisma.workSession.count()).toBe(1);
  });

  it('two simultaneous starts create exactly one session', async () => {
    const e = await employeeAs(app, prisma);
    const [a, b] = await Promise.all([start(e.token), start(e.token)]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
    expect(await prisma.workSession.count()).toBe(1);
  });

  it('a retried start with the same point does not duplicate the point', async () => {
    const e = await employeeAs(app, prisma);
    const body = { deviceTime: new Date().toISOString(), initialLocation: fix() };
    await start(e.token, body).expect(201);
    await start(e.token, body).expect(409);
    expect(await prisma.locationPoint.count()).toBe(1);
  });

  it('starts without a location when the phone could not get a fix', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token, { deviceTime: new Date().toISOString() }).expect(201);
    expect(res.body.session.lastLocationAt).toBeNull();
  });

  it('flags poor or impossible-time fixes instead of dropping them', async () => {
    const e = await employeeAs(app, prisma);
    await start(e.token, {
      deviceTime: new Date().toISOString(),
      initialLocation: fix({ accuracyMeters: 250 }),
    }).expect(201);
    const p = await prisma.locationPoint.findFirstOrThrow();
    expect(p.qualityFlag).toBe('LOW_ACCURACY');
  });

  it('rejects impossible coordinates with a field message', async () => {
    const e = await employeeAs(app, prisma);
    const res = await start(e.token, {
      deviceTime: new Date().toISOString(),
      initialLocation: fix({ latitude: 95 }),
    }).expect(400);
    expect(res.body.error.details.fields['initialLocation.latitude']).toBe('Latitude must be between -90 and 90.');
  });

  it('active is null when off duty and the session when working', async () => {
    const e = await employeeAs(app, prisma);
    expect((await active(e.token).expect(200)).body.session).toBeNull();
    const s = await start(e.token).expect(201);
    expect((await active(e.token).expect(200)).body.session.id).toBe(s.body.session.id);
  });

  it('end uses server time for the duration and stores an END point', async () => {
    const e = await employeeAs(app, prisma);
    const s = await start(e.token).expect(201);
    await prisma.workSession.update({
      where: { id: s.body.session.id },
      data: { startedAtServer: new Date(Date.now() - 90 * 60_000) },
    });
    // Phone clock is 3 hours wrong; the duration must not care.
    const res = await end(e.token, s.body.session.id, {
      deviceTime: new Date(Date.now() + 3 * 3600_000).toISOString(),
      finalLocation: fix(),
    }).expect(200);
    expect(res.body.session).toMatchObject({ status: 'COMPLETED', totalMinutes: 90 });
    const sources = (await prisma.locationPoint.findMany({ orderBy: { capturedAt: 'asc' } })).map((p) => p.source);
    expect(sources).toEqual(['START', 'END']);
    expect((await active(e.token)).body.session).toBeNull();
  });

  it('ending twice is a clear 409, and a new start works afterwards', async () => {
    const e = await employeeAs(app, prisma);
    const s = await start(e.token).expect(201);
    await end(e.token, s.body.session.id).expect(200);
    const again = await end(e.token, s.body.session.id).expect(409);
    expect(again.body.error.code).toBe('SESSION_NOT_ACTIVE');
    await start(e.token).expect(201);
  });

  it("cannot end someone else's session, in the same company or another", async () => {
    const a = await employeeAs(app, prisma);
    const sameCompany = await employeeAs(app, prisma, a.user.companyId);
    const otherCompany = await employeeAs(app, prisma);
    const s = await start(a.token).expect(201);
    await end(sameCompany.token, s.body.session.id).expect(404);
    await end(otherCompany.token, s.body.session.id).expect(404);
    await end(a.token, 'not-a-uuid').expect(404);
  });

  it('admins cannot start sessions', async () => {
    const admin = await signupAs(app);
    await start(admin.token).expect(403);
  });

  it('an EMPLOYEE login without an employee record gets a clear 403', async () => {
    const e = await employeeAs(app, prisma);
    await prisma.employee.update({ where: { id: e.employee.id }, data: { userId: null } });
    const res = await start(e.token).expect(403);
    expect(res.body.error.code).toBe('NOT_AN_EMPLOYEE');
  });
});
```
Run `pnpm exec vitest run --config vitest.config.e2e.ts test/e2e/sessions` → FAIL (404 routes).

- [ ] **Step 5: Implement the service.** `src/modules/sessions/services/sessions.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { type Employee, Prisma, type WorkSession } from '@prisma/client';
import type {
  ActiveSessionResponse,
  EndSessionInput,
  LocationFix,
  SessionMutationResponse,
  StartSessionInput,
  WorkSessionDto,
} from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { qualityFor } from '../../../common/utils/location-quality.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Work sessions for the signed-in employee. One ACTIVE session at most (DB-enforced). */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async active(auth: AuthContext): Promise<ActiveSessionResponse> {
    const employee = await this.employeeFor(auth);
    const session = await this.prisma.workSession.findFirst({
      where: { employeeId: employee.id, status: 'ACTIVE' },
    });
    return { session: session ? await this.toDto(session) : null, serverTime: new Date().toISOString() };
  }

  async start(auth: AuthContext, input: StartSessionInput): Promise<SessionMutationResponse> {
    const employee = await this.employeeFor(auth);
    const now = new Date();
    try {
      const session = await this.prisma.$transaction(async (tx) => {
        const created = await tx.workSession.create({
          data: {
            companyId: employee.companyId,
            employeeId: employee.id,
            startedAtServer: now,
            startedAtDevice: new Date(input.deviceTime),
          },
        });
        if (input.initialLocation) {
          await tx.locationPoint.createMany({
            data: [this.point(employee, created.id, input.initialLocation, 'START', now)],
            skipDuplicates: true,
          });
        }
        return created;
      });
      return { session: await this.toDto(session), serverTime: now.toISOString() };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const running = await this.prisma.workSession.findFirst({
          where: { employeeId: employee.id, status: 'ACTIVE' },
        });
        if (running) {
          throw new AppError(409, 'SESSION_ALREADY_ACTIVE', 'You already have a work session running.', {
            session: await this.toDto(running),
          });
        }
      }
      throw e;
    }
  }

  async end(auth: AuthContext, sessionId: string, input: EndSessionInput): Promise<SessionMutationResponse> {
    const employee = await this.employeeFor(auth);
    const notFound = new AppError(404, 'NOT_FOUND', 'Work session not found.');
    if (!UUID.test(sessionId)) throw notFound;
    const session = await this.prisma.workSession.findFirst({
      where: { id: sessionId, employeeId: employee.id },
    });
    if (!session) throw notFound;

    const now = new Date();
    const totalMinutes = Math.max(0, Math.round((now.getTime() - session.startedAtServer.getTime()) / 60_000));
    const ended = await this.prisma.$transaction(async (tx) => {
      // Conditional update: two simultaneous End taps can't both succeed.
      const claimed = await tx.workSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: {
          status: 'COMPLETED',
          endedAtServer: now,
          endedAtDevice: new Date(input.deviceTime),
          totalMinutes,
        },
      });
      if (claimed.count === 0) {
        throw new AppError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.');
      }
      if (input.finalLocation) {
        await tx.locationPoint.createMany({
          data: [this.point(employee, session.id, input.finalLocation, 'END', now)],
          skipDuplicates: true,
        });
      }
      return tx.workSession.findUniqueOrThrow({ where: { id: session.id } });
    });
    return { session: await this.toDto(ended), serverTime: now.toISOString() };
  }

  /** The employee record behind the signed-in user (always scoped to their company). */
  private async employeeFor(auth: AuthContext): Promise<Employee> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: auth.userId, companyId: auth.companyId },
    });
    if (!employee) {
      throw new AppError(403, 'NOT_AN_EMPLOYEE', 'This account is not linked to an employee. Contact your company admin.');
    }
    return employee;
  }

  private point(
    employee: Employee,
    sessionId: string,
    fix: LocationFix,
    source: 'START' | 'END',
    now: Date,
  ): Prisma.LocationPointCreateManyInput {
    const capturedAt = new Date(fix.capturedAt);
    return {
      companyId: employee.companyId,
      employeeId: employee.id,
      sessionId,
      clientPointId: fix.clientPointId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyMeters: fix.accuracyMeters ?? null,
      batteryLevel: fix.batteryLevel ?? null,
      source,
      capturedAt,
      qualityFlag: qualityFor(fix.accuracyMeters, capturedAt, now),
    };
  }

  private async toDto(s: WorkSession): Promise<WorkSessionDto> {
    const last = await this.prisma.locationPoint.aggregate({
      where: { sessionId: s.id },
      _max: { capturedAt: true },
    });
    return {
      id: s.id,
      status: s.status,
      startedAt: s.startedAtServer.toISOString(),
      endedAt: s.endedAtServer?.toISOString() ?? null,
      totalMinutes: s.totalMinutes,
      lastLocationAt: last._max.capturedAt?.toISOString() ?? null,
    };
  }
}
```

`src/modules/sessions/controllers/sessions.controller.ts`:
```ts
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { type EndSessionInput, EndSessionSchema, type StartSessionInput, StartSessionSchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { SessionsService } from '../services/sessions.service.js';

@Roles('EMPLOYEE')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('me/active')
  active(@CurrentAuth() auth: AuthContext) {
    return this.sessions.active(auth);
  }

  @Post('start')
  start(@CurrentAuth() auth: AuthContext, @Body(new ZodBody(StartSessionSchema)) body: StartSessionInput) {
    return this.sessions.start(auth, body);
  }

  @Post(':sessionId/end')
  @HttpCode(200)
  end(
    @CurrentAuth() auth: AuthContext,
    @Param('sessionId') sessionId: string,
    @Body(new ZodBody(EndSessionSchema)) body: EndSessionInput,
  ) {
    return this.sessions.end(auth, sessionId, body);
  }
}
```

`src/modules/sessions/sessions.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SessionsController } from './controllers/sessions.controller.js';
import { SessionsService } from './services/sessions.service.js';

@Module({ controllers: [SessionsController], providers: [SessionsService] })
export class SessionsModule {}
```
Add `SessionsModule` to `app.module.ts` imports after `InvitationsModule`.

- [ ] **Step 6: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint` → PASS (unit 20, e2e 60).

- [ ] **Step 7: Commit.** `git commit -am "feat(api): employee work sessions — start, end, active, with START/END points"` (also `git add` the new files).

---

### Task 3: Profile API (`GET /me`)

**Files:**
- Create: `apps/api/src/modules/me/{me.module.ts,controllers/me.controller.ts,services/me.service.ts}`, `apps/api/test/e2e/me.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `GET /api/v1/me` → `MeResponse` (any role). `employee` is `null` for OWNER/ADMIN.

- [ ] **Step 1: Write the failing test.** `apps/api/test/e2e/me.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('GET /me', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns the employee record and company for an employee', async () => {
    const e = await employeeAs(app, prisma);
    await prisma.employee.update({ where: { id: e.employee.id }, data: { designation: 'Field Technician' } });
    const res = await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${e.token}`).expect(200);
    expect(res.body).toMatchObject({
      user: { role: 'EMPLOYEE', email: e.user.email },
      employee: { id: e.employee.id, designation: 'Field Technician' },
      company: { timezone: 'Asia/Kolkata' },
    });
  });

  it('returns employee: null for an admin', async () => {
    const a = await signupAs(app);
    const res = await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(res.body.employee).toBeNull();
    expect(res.body.company.name).toEqual(expect.any(String));
  });
});
```
Run it → FAIL (404).

- [ ] **Step 2: Implement.** `src/modules/me/services/me.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toAuthUser } from '../../auth/services/tokens.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(auth: AuthContext): Promise<MeResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId, status: 'ACTIVE' },
      include: { employee: true, company: true },
    });
    if (!user) throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    const e = user.employee;
    return {
      user: toAuthUser(user),
      employee: e
        ? { id: e.id, name: e.name, designation: e.designation, employeeCode: e.employeeCode, phone: e.phone }
        : null,
      company: { name: user.company.name, timezone: user.company.timezone },
    };
  }
}
```
`src/modules/me/controllers/me.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { MeService } from '../services/me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext) {
    return this.me.get(auth);
  }
}
```
`src/modules/me/me.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MeController } from './controllers/me.controller.js';
import { MeService } from './services/me.service.js';

@Module({ controllers: [MeController], providers: [MeService] })
export class MeModule {}
```
Add `MeModule` to `app.module.ts`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test` → PASS (e2e 62).
- [ ] **Step 4: Commit.** `git commit -m "feat(api): GET /me profile for the employee app"`

---

### Task 4: Scaffold the Expo app, theme and shared components

**Files:**
- Create: `apps/mobile` (template), `apps/mobile/app.json`, `apps/mobile/.env.example`, `apps/mobile/src/config.ts`, `apps/mobile/src/theme/theme.ts`, `apps/mobile/src/components/{Screen,Button,TextField,Logo,StatusPill,Notice}.tsx`, `apps/mobile/test/setup.ts`, `apps/mobile/test/mocks/expo-router.ts`, `apps/mobile/test/components.test.tsx`
- Modify: root `.env.example`, `.gitignore`, `pnpm-workspace.yaml`

**Interfaces:**
- Produces:
  - `colors`, `fonts`, `radius`, `ctaGradient` (theme)
  - `<Screen>`, `<Button title variant loading disabled onPress>`, `<TextField label error hint secureTextEntry …TextInputProps>`, `<Logo size>`, `<StatusPill tone="working"|"off">`, `<Notice tone="info"|"warning">`
  - `API_URL`

- [ ] **Step 1: Read the bundled docs first.** Expo SDK 57 may differ from what you remember. After Step 2's install, read `apps/mobile/node_modules/expo-router/build/` README and the docs links printed by `npx expo-doctor` for: protected routes (`Stack.Protected`), `src/app` routing, and monorepo/pnpm support. If anything below conflicts with them, follow the docs and record a ruling in the ledger.

- [ ] **Step 2: Scaffold.**
```bash
cd apps
pnpm create expo-app@latest mobile --template default --no-install
cd mobile
node -e "const p=require('./package.json');p.name='@worktrail/mobile';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
cd ../..
pnpm install
cd apps/mobile
pnpm expo install expo-secure-store expo-location expo-crypto expo-battery expo-linear-gradient react-native-svg @expo-google-fonts/barlow @expo-google-fonts/barlow-semi-condensed expo-font expo-splash-screen
pnpm add @tanstack/react-query zustand date-fns date-fns-tz zod@^4 "@worktrail/types@workspace:*" "@worktrail/ui@workspace:*"
pnpm add -D jest-expo jest @testing-library/react-native @types/jest
pnpm expo install --fix
npx expo-doctor
```
Expected: `expo-doctor` passes. If it reports duplicate React Native copies or unresolved workspace packages under pnpm's isolated install, add `node-linker=hoisted` to a root `.npmrc`, run `pnpm install` again, and ledger the ruling.

Delete the template's demo screens and components (`src/app/(tabs)`, `src/components/*` from the template, `src/hooks/*` from the template, `scripts/reset-project.js`) so only Work Trail code remains. If the template put routes in `app/` instead of `src/app/`, move them to `src/app/`. Expo Router picks up `src/app` automatically.

- [ ] **Step 3: Configure the app.** `apps/mobile/app.json`:
```json
{
  "expo": {
    "name": "Work Trail",
    "slug": "work-trail",
    "scheme": "worktrail",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "icon": "./assets/images/icon.png",
    "splash": { "backgroundColor": "#FBF8F5", "image": "./assets/images/splash-icon.png", "resizeMode": "contain" },
    "android": {
      "package": "in.worktrail.app",
      "adaptiveIcon": { "foregroundImage": "./assets/images/adaptive-icon.png", "backgroundColor": "#FE5A0C" },
      "permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Work Trail records your location when you start and end work, so your company can see where your work day began and finished."
        }
      ]
    ],
    "experiments": { "typedRoutes": true }
  }
}
```
Background location permission is added in Phase 3, not now.

`apps/mobile/.env.example`:
```
# Address of the computer running the API, as seen from the phone (same Wi-Fi).
# Android emulator: http://10.0.2.2:4000
EXPO_PUBLIC_API_URL=http://192.168.1.108:4000
```
Copy it to `apps/mobile/.env` and put your own LAN IP in it (`ipconfig` → IPv4 Address). Add the same variable with that comment to the root `.env.example`. Add `apps/mobile/.env` and `apps/mobile/android/` to `.gitignore`.

`src/config.ts`:
```ts
/** API base URL, set per developer in apps/mobile/.env. Emulator default reaches the host machine. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

/** Website pages the app links out to (password reset lives on the web). */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? API_URL.replace(':4000', ':3000');
```

- [ ] **Step 4: Jest setup.** Add to `apps/mobile/package.json`:
```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "test": "jest",
  "typecheck": "tsc --noEmit",
  "lint": "expo lint"
},
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/test/setup.ts"],
  "testMatch": ["<rootDir>/test/**/*.test.{ts,tsx}"],
  "transformIgnorePatterns": [
    "node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|react-navigation|@react-navigation/.*|react-native-svg|@worktrail/.*))"
  ]
}
```

`test/setup.ts`:
```ts
// In-memory SecureStore so auth code runs under Jest.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __reset: () => store.clear(),
  };
});

// Screens navigate with expo-router; tests import mockRouter from test/mocks/expo-router.
jest.mock('expo-router', () => require('./mocks/expo-router'));

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
```

`test/mocks/expo-router.ts` (one module instance shared by screens and tests):
```ts
export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
export const useRouter = () => mockRouter;
export const useLocalSearchParams = jest.fn(() => ({}));
export const Link = ({ children }: { children: unknown }) => children;
export const Redirect = () => null;
export const Stack = Object.assign(() => null, { Screen: () => null, Protected: () => null });
```

- [ ] **Step 5: Write the failing component tests.** `test/components.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { Logo } from '../src/components/Logo';

describe('components', () => {
  it('Button is disabled and busy while loading', () => {
    const onPress = jest.fn();
    render(<Button title="Start work" loading onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Start work' });
    expect(btn).toBeDisabled();
    expect(btn.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('TextField shows its error and toggles password visibility', () => {
    render(<TextField label="Password" secureTextEntry error="Enter your password." />);
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });

  it('Logo has one accessible name', () => {
    render(<Logo />);
    expect(screen.getByLabelText('Work Trail')).toBeOnTheScreen();
  });
});
```
Run `pnpm --filter @worktrail/mobile test` → FAIL (modules missing).

- [ ] **Step 6: Implement the theme and components.**

`src/theme/theme.ts`:
```ts
import { tokens } from '@worktrail/ui';

const c = tokens.color;
export const colors = {
  canvas: c.canvas,
  surface: c.surface,
  line: c.line,
  ink900: c.ink[900],
  ink700: c.ink[700],
  ink500: c.ink[500],
  ink300: c.ink[300],
  brand50: c.brand[50],
  brand100: c.brand[100],
  brand200: c.brand[200],
  brand500: c.brand[500],
  brand700: c.brand[700],
  success50: c.success[50],
  success500: c.success[500],
  danger500: c.danger[500],
} as const;

export const ctaGradient = [c.brand[400], c.brand[600]] as const;
export const radius = tokens.radius;

export const fonts = {
  body: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  display: 'BarlowSemiCondensed_700Bold',
} as const;

export const shadow = {
  shadowColor: '#17130F',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
```

`src/components/Screen.tsx`:
```tsx
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

type Props = { children: React.ReactNode; scroll?: boolean; style?: ViewStyle };

/** Page wrapper: warm canvas background, safe-area padding, optional scrolling. */
export function Screen({ children, scroll = true, style }: Props) {
  const body = <View style={[styles.body, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1, paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
});
```

`src/components/Button.tsx`:
```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, ctaGradient, fonts, radius } from '../theme/theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const isDisabled = Boolean(disabled || loading);
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        !primary && styles.secondary,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {primary ? (
        <LinearGradient colors={ctaGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.brand700} />
      ) : (
        <Text style={[styles.label, !primary && styles.labelSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.input,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand200 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.9 },
  label: { color: '#fff', fontFamily: fonts.semibold, fontSize: 17 },
  labelSecondary: { color: colors.brand700 },
});
```

`src/components/TextField.tsx`:
```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, fonts, radius } from '../theme/theme';

type Props = TextInputProps & { label: string; error?: string | null; hint?: string };

export function TextField({ label, error, hint, secureTextEntry, ...rest }: Props) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, error ? styles.boxError : null]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.ink300}
          style={styles.input}
          secureTextEntry={hidden}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
          >
            <Text style={styles.toggle}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  boxError: { borderColor: colors.danger500 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink900, paddingVertical: 12 },
  toggle: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 14 },
  error: { fontFamily: fonts.body, color: colors.danger500, fontSize: 14 },
  hint: { fontFamily: fonts.body, color: colors.ink500, fontSize: 14 },
});
```

`src/components/Logo.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const h = size === 'lg' ? 40 : 30;
  return (
    <View accessible accessibilityLabel="Work Trail" accessibilityRole="image" style={styles.row}>
      <Svg width={h * 0.75} height={h} viewBox="0 0 24 32">
        <Path d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z" fill={colors.brand500} />
        <Circle cx={12} cy={11} r={4} fill="#fff" />
        <Path d="M4 30c4-3 12 1 16-2" stroke={colors.brand500} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={[styles.word, { fontSize: size === 'lg' ? 40 : 26 }]} importantForAccessibility="no">
        <Text style={{ color: colors.ink900 }}>Work </Text>
        <Text style={{ color: colors.brand500 }}>Trail</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: fonts.display, letterSpacing: -0.3 },
});
```

`src/components/StatusPill.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';

export function StatusPill({ tone, label }: { tone: 'working' | 'off'; label: string }) {
  const working = tone === 'working';
  return (
    <View style={[styles.pill, { backgroundColor: working ? colors.success50 : colors.surface }]}>
      <View style={[styles.dot, { backgroundColor: working ? colors.success500 : colors.ink300 }]} />
      <Text style={[styles.text, { color: working ? colors.success500 : colors.ink500 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.semibold, fontSize: 14 },
});
```

`src/components/Notice.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme/theme';

/** Inline message box. "warning" is announced to screen readers. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: React.ReactNode }) {
  return (
    <View
      accessibilityRole={tone === 'warning' ? 'alert' : undefined}
      style={[styles.box, tone === 'warning' ? styles.warning : styles.info]}
    >
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.input, padding: 14, borderWidth: 1 },
  info: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  warning: { backgroundColor: '#FFF4F2', borderColor: '#F8C9C0' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink900 },
});
```

- [ ] **Step 7: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS (3 tests).
- [ ] **Step 8: Commit.** `git add apps/mobile .env.example .gitignore pnpm-workspace.yaml pnpm-lock.yaml && git commit -m "feat(mobile): Expo app scaffold with Work Trail theme and base components"`

---

### Task 5: API client and sign-in state (mobile)

**Files:**
- Create: `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/index.ts`, `apps/mobile/src/auth/token-storage.ts`, `apps/mobile/src/auth/auth-store.ts`, `apps/mobile/test/api-client.test.ts`, `apps/mobile/test/auth-store.test.ts`

**Interfaces:**
- Produces:
  - `ApiError(status, code, message, details)`
  - `createApiClient({ baseUrl, fetchFn?, getAccessToken, refreshAccessToken, onSessionExpired }) → { request<T>(method, path, body?, { auth? }) }`
  - The `api` singleton
  - `useAuthStore` with state `{ status: 'loading'|'offline'|'signedOut'|'signedIn'; user: AuthUser|null; accessToken: string|null }` and actions `bootstrap()`, `signIn(email, password)`, `acceptInvite(token, name, password)`, `signOut()`, `refreshAccessToken()`, `clearLocal()`
  - `tokenStorage.{get,set,clear}`

- [ ] **Step 1: Write the failing tests.**

`test/api-client.test.ts`:
```ts
import { ApiError, createApiClient } from '../src/api/client';

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const err = (status: number, code: string, message: string) =>
  Promise.resolve(new Response(JSON.stringify({ error: { code, message, details: {} } }), { status }));

function setup(overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  let token: string | null = 'old';
  const fetchFn = jest.fn();
  const refreshAccessToken = jest.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
    token = 'new';
    return token;
  });
  const onSessionExpired = jest.fn();
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetchFn,
    getAccessToken: () => token,
    refreshAccessToken,
    onSessionExpired,
    ...overrides,
  });
  return { client, fetchFn, refreshAccessToken, onSessionExpired };
}

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValueOnce(ok({ hi: 1 }));
    await expect(client.request('GET', '/me')).resolves.toEqual({ hi: 1 });
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/api/v1/me', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer old' }),
    }));
  });

  it('refreshes once for many simultaneous 401s and retries each request', async () => {
    const { client, fetchFn, refreshAccessToken } = setup();
    fetchFn.mockImplementation((_url: string, init: RequestInit) =>
      (init.headers as Record<string, string>).authorization === 'Bearer new' ? ok({ ok: true }) : err(401, 'TOKEN_EXPIRED', 'x'),
    );
    const results = await Promise.all([client.request('GET', '/a'), client.request('GET', '/b'), client.request('GET', '/c')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('signs out when refresh is refused', async () => {
    const { client, fetchFn, onSessionExpired } = setup({ refreshAccessToken: jest.fn(async () => null) });
    fetchFn.mockReturnValue(err(401, 'TOKEN_EXPIRED', 'x'));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('turns API error envelopes into ApiError with the server message', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValue(err(409, 'SESSION_ALREADY_ACTIVE', 'You already have a work session running.'));
    const e = await client.request('POST', '/sessions/start', {}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 409, code: 'SESSION_ALREADY_ACTIVE', message: 'You already have a work session running.' });
  });

  it('reports being offline in plain words', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockRejectedValue(new TypeError('Network request failed'));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({
      code: 'NETWORK',
      message: 'You appear to be offline. Check your connection and try again.',
    });
  });

  it('does not send a token or refresh for public calls', async () => {
    const { client, fetchFn, refreshAccessToken } = setup();
    fetchFn.mockReturnValue(err(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'));
    await expect(client.request('POST', '/auth/login', {}, { auth: false })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('authorization');
  });
});
```

`test/auth-store.test.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/auth/auth-store';

const tokens = (role: string) => ({
  accessToken: 'at',
  refreshToken: 'rt-1',
  user: { id: 'u', role, companyId: 'c', name: 'Amit Kumar', email: 'amit@demo.worktrail.in' },
});
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
  (SecureStore as unknown as { __reset: () => void }).__reset();
  useAuthStore.setState({ status: 'loading', user: null, accessToken: null });
});

describe('auth store', () => {
  it('signIn stores the refresh token securely and signs in an employee', async () => {
    fetchMock.mockReturnValueOnce(json(tokens('EMPLOYEE')));
    await useAuthStore.getState().signIn('amit@demo.worktrail.in', 'pw');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'at' });
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
  });

  it('refuses admins, revokes their token and stores nothing', async () => {
    fetchMock.mockReturnValueOnce(json(tokens('OWNER'))).mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })));
    await expect(useAuthStore.getState().signIn('a@b.in', 'pw')).rejects.toMatchObject({
      code: 'USE_WEB_DASHBOARD',
      message: 'This app is for field employees. Company admins sign in on the Work Trail website.',
    });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/logout$/);
    expect(await SecureStore.getItemAsync('wt.refresh')).toBeNull();
    expect(useAuthStore.getState().status).not.toBe('signedIn');
  });

  it('bootstrap with no saved token goes to signed out', async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('bootstrap restores a saved session via refresh', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockReturnValueOnce(json(tokens('EMPLOYEE')));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
  });

  it('bootstrap while offline keeps the saved token and shows the offline state', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('offline');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-0');
  });

  it('a refused refresh (disabled or revoked) signs out and forgets the token', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockReturnValueOnce(json({ error: { code: 'SESSION_EXPIRED', message: 'x', details: {} } }, 401));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBeNull();
  });
});
```
Run `pnpm --filter @worktrail/mobile test` → FAIL (modules missing).

- [ ] **Step 2: Implement.**

`src/api/client.ts`:
```ts
import type { ApiErrorBody } from '@worktrail/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST';
type Deps = {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken: () => string | null;
  /** Returns a fresh access token, or null when the session can't be renewed. */
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => void;
};

export type ApiClient = {
  request<T>(method: Method, path: string, body?: unknown, opts?: { auth?: boolean }): Promise<T>;
};

const OFFLINE = 'You appear to be offline. Check your connection and try again.';

export function createApiClient(deps: Deps): ApiClient {
  const fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let refreshing: Promise<string | null> | null = null;

  // Refresh tokens rotate and reuse is treated as theft, so concurrent 401s must share one refresh.
  const refreshOnce = () => {
    refreshing ??= deps.refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  async function send(method: Method, path: string, body: unknown, token: string | null) {
    try {
      return await fetchFn(`${deps.baseUrl}/api/v1${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', OFFLINE);
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return json as T;
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong. Try again.', e?.details ?? {});
  }

  return {
    async request<T>(method: Method, path: string, body?: unknown, opts: { auth?: boolean } = {}) {
      const auth = opts.auth ?? true;
      let res = await send(method, path, body, auth ? deps.getAccessToken() : null);
      if (auth && res.status === 401) {
        const token = await refreshOnce();
        if (!token) {
          deps.onSessionExpired();
          throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
        }
        res = await send(method, path, body, token);
        if (res.status === 401) deps.onSessionExpired();
      }
      return parse<T>(res);
    },
  };
}
```

`src/auth/token-storage.ts`:
```ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'wt.refresh';

/** The long-lived refresh token, kept in Android's encrypted storage. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
```

`src/api/index.ts`:
```ts
import { API_URL } from '../config';
import { useAuthStore } from '../auth/auth-store';
import { createApiClient } from './client';

export { ApiError } from './client';

/** The app's API client. Reads the in-memory access token; refreshes through the auth store. */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refreshAccessToken(),
  onSessionExpired: () => void useAuthStore.getState().clearLocal(),
});
```

`src/auth/auth-store.ts`:
```ts
import { create } from 'zustand';
import type { AuthTokens, AuthUser } from '@worktrail/types';
import { api, ApiError } from '../api';
import { tokenStorage } from './token-storage';

type Status = 'loading' | 'offline' | 'signedOut' | 'signedIn';

type AuthState = {
  status: Status;
  user: AuthUser | null;
  accessToken: string | null;
  bootstrap(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  acceptInvite(token: string, name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshAccessToken(): Promise<string | null>;
  clearLocal(): Promise<void>;
};

const isNetwork = (e: unknown) => e instanceof ApiError && e.code === 'NETWORK';

export const useAuthStore = create<AuthState>((set, get) => {
  /** Accepts tokens from login/invite. Only employees may use the app. */
  async function adopt(tokens: AuthTokens) {
    if (tokens.user.role !== 'EMPLOYEE') {
      await api.request('POST', '/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false }).catch(() => undefined);
      throw new ApiError(403, 'USE_WEB_DASHBOARD', 'This app is for field employees. Company admins sign in on the Work Trail website.');
    }
    await tokenStorage.set(tokens.refreshToken);
    set({ status: 'signedIn', user: tokens.user, accessToken: tokens.accessToken });
  }

  return {
    status: 'loading',
    user: null,
    accessToken: null,

    async bootstrap() {
      set({ status: 'loading' });
      if (!(await tokenStorage.get())) return set({ status: 'signedOut' });
      try {
        const token = await get().refreshAccessToken();
        if (token) set({ status: 'signedIn' });
      } catch (e) {
        if (isNetwork(e)) set({ status: 'offline' });
        else await get().clearLocal();
      }
    },

    async signIn(email, password) {
      const tokens = await api.request<AuthTokens>('POST', '/auth/login', { email, password }, { auth: false });
      await adopt(tokens);
    },

    async acceptInvite(token, name, password) {
      const tokens = await api.request<AuthTokens>(
        'POST',
        `/employees/invitations/${encodeURIComponent(token)}/accept`,
        { name, password },
        { auth: false },
      );
      await adopt(tokens);
    },

    async signOut() {
      const refreshToken = await tokenStorage.get();
      if (refreshToken) {
        await api.request('POST', '/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
      }
      await get().clearLocal();
    },

    /** Rotates the refresh token. Offline → throws NETWORK (token kept); refused → signs out. */
    async refreshAccessToken() {
      const refreshToken = await tokenStorage.get();
      if (!refreshToken) {
        await get().clearLocal();
        return null;
      }
      try {
        const tokens = await api.request<AuthTokens>('POST', '/auth/refresh', { refreshToken }, { auth: false });
        await tokenStorage.set(tokens.refreshToken);
        set({ accessToken: tokens.accessToken, user: tokens.user });
        return tokens.accessToken;
      } catch (e) {
        if (isNetwork(e)) throw e;
        await get().clearLocal();
        return null;
      }
    },

    async clearLocal() {
      await tokenStorage.clear();
      set({ status: 'signedOut', user: null, accessToken: null });
    },
  };
});
```
`api` and `useAuthStore` import each other. That's safe here because neither is used while the modules load, only when a function is called.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test` → PASS (15 tests).
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): API client with single-flight refresh and secure sign-in state"`

---

### Task 6: Welcome, sign-in and join screens (mobile)

**Files:**
- Create: `apps/mobile/src/auth/invite-token.ts`, `apps/mobile/assets/welcome-trail.png`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/offline.tsx`, `apps/mobile/src/app/(auth)/{_layout,welcome,login,join}.tsx`, `apps/mobile/test/invite-token.test.ts`, `apps/mobile/test/screens/login.test.tsx`, `apps/mobile/test/screens/join.test.tsx`
- Modify: none outside `apps/mobile`

**Interfaces:**
- Consumes: `useAuthStore`, `api`, `ApiError`, `LoginSchema`, `AcceptInvitationSchema`, `InvitationPreview`, components from Task 4, and `WEB_URL`.
- Produces:
  - `extractInviteToken(text: string): string | null`
  - Routes: `/(auth)/welcome`, `/(auth)/login`, `/(auth)/join?token=`, `/offline`
  - The root auth gate

- [ ] **Step 1: Crop the welcome illustration.**
```bash
cd apps/mobile && python -c "from PIL import Image; im=Image.open('../../docs/specs/Landing page.png').convert('RGB'); im.crop((40,600,810,1265)).save('assets/welcome-trail.png')" && cd ../..
```
(This cuts the person-and-route illustration out of the mockup as temporary artwork, the same approach as the web auth panel.)

- [ ] **Step 2: Write the failing tests.**

`test/invite-token.test.ts`:
```ts
import { extractInviteToken } from '../src/auth/invite-token';

const T = 'KPCJwGEbnzgh2-WdirU_MssvgWChJLBPYVqFlKTWAOM';

describe('extractInviteToken', () => {
  it.each([
    [`http://localhost:3000/invite/${T}`],
    [`https://app.worktrail.in/invite/${T}?utm=wa`],
    [`Join our team on Work Trail. Set your password here: https://app.worktrail.in/invite/${T}`],
    [`worktrail://invite/${T}`],
    [`  ${T}  `],
  ])('finds the token in %s', (text) => {
    expect(extractInviteToken(text)).toBe(T);
  });

  it.each(['', 'hello', 'https://app.worktrail.in/login'])('returns null for %s', (text) => {
    expect(extractInviteToken(text)).toBeNull();
  });
});
```

`test/screens/login.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../src/app/(auth)/login';
import { useAuthStore } from '../../src/auth/auth-store';
import { ApiError } from '../../src/api/client';

describe('Login screen', () => {
  const signIn = jest.fn();
  beforeEach(() => {
    signIn.mockReset();
    useAuthStore.setState({ signIn });
  });

  async function submit(email: string, password: string) {
    fireEvent.changeText(screen.getByLabelText('Email address'), email);
    fireEvent.changeText(screen.getByLabelText('Password'), password);
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('validates before calling the server', async () => {
    render(<LoginScreen />);
    await submit('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with a normalised email', async () => {
    signIn.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await submit('  Amit@Demo.WorkTrail.in ', 'WorkTrail@demo1');
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('amit@demo.worktrail.in', 'WorkTrail@demo1'));
  });

  it('shows the server message, including the admin redirect', async () => {
    signIn.mockRejectedValue(new ApiError(403, 'USE_WEB_DASHBOARD', 'This app is for field employees. Company admins sign in on the Work Trail website.'));
    render(<LoginScreen />);
    await submit('rahul@acme.in', 'StrongPass1');
    expect(await screen.findByText('This app is for field employees. Company admins sign in on the Work Trail website.')).toBeOnTheScreen();
  });
});
```

`test/screens/join.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import JoinScreen from '../../src/app/(auth)/join';
import { useAuthStore } from '../../src/auth/auth-store';

const T = 'KPCJwGEbnzgh2-WdirU_MssvgWChJLBPYVqFlKTWAOM';
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('Join screen', () => {
  const acceptInvite = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    acceptInvite.mockReset();
    useAuthStore.setState({ acceptInvite });
  });

  it('looks up the invite from a pasted WhatsApp message, then joins', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      companyName: 'Demo Field Services Pvt Ltd', employeeName: 'Ravi Kumar', email: 'ravi@example.com', expiresAt: '2026-10-12T00:00:00Z',
    })));
    acceptInvite.mockResolvedValue(undefined);
    render(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText('Invite link'), `Set your password here: http://192.168.1.108:3000/invite/${T}`);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Join Demo Field Services Pvt Ltd')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your name').props.value).toBe('Ravi Kumar');
    fireEvent.changeText(screen.getByLabelText('Create a password'), 'StrongPass1');
    fireEvent.press(screen.getByRole('button', { name: 'Join and sign in' }));
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith(T, 'Ravi Kumar', 'StrongPass1'));
  });

  it('explains a used or expired link', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'INVITE_INVALID', message: 'This invite link has expired or was already used. Ask your admin for a new one.', details: {} },
    }), { status: 410 }));
    render(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText('Invite link'), T);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('This invite link has expired or was already used. Ask your admin for a new one.')).toBeOnTheScreen();
  });

  it('asks for a real link when nothing usable was pasted', async () => {
    render(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText('Invite link'), 'hello');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Paste the full invite link your admin sent you.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```
Run them → FAIL.

- [ ] **Step 3: Implement.**

`src/auth/invite-token.ts`:
```ts
const TOKEN = /[A-Za-z0-9_-]{43}/;

/** Finds the invite token in a pasted link, a forwarded message or a bare token. */
export function extractInviteToken(text: string): string | null {
  const fromLink = /invite\/([A-Za-z0-9_-]{43})/.exec(text)?.[1];
  if (fromLink) return fromLink;
  const bare = text.trim();
  return bare.length === 43 && TOKEN.test(bare) ? bare : null;
}
```

`src/app/_layout.tsx`:
```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { useAuthStore } from '../auth/auth-store';

void SplashScreen.preventAutoHideAsync();
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, BarlowSemiCondensed_700Bold });
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void useAuthStore.getState().bootstrap();
    // Never show one person's data to the next person who signs in on this phone.
    return useAuthStore.subscribe((s, prev) => {
      if (prev.status === 'signedIn' && s.status === 'signedOut') queryClient.clear();
    });
  }, []);

  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FBF8F5' } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'offline'}>
          <Stack.Screen name="offline" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
```

`src/app/offline.tsx`:
```tsx
import { Text } from 'react-native';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Screen } from '../components/Screen';
import { useAuthStore } from '../auth/auth-store';
import { colors, fonts } from '../theme/theme';

export default function OfflineScreen() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return (
    <Screen>
      <Logo />
      <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink900, marginTop: 24 }}>Can&apos;t reach Work Trail</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 16, color: colors.ink700 }}>
        You&apos;re still signed in. Check your mobile data or Wi-Fi, then try again.
      </Text>
      <Button title="Try again" onPress={() => void bootstrap()} />
    </Screen>
  );
}
```

`src/app/(auth)/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack initialRouteName="welcome" screenOptions={{ headerShown: false }} />;
}
```

`src/app/(auth)/welcome.tsx`:
```tsx
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, shadow } from '../../theme/theme';

const TILES = ['Record work sessions', 'Submit quick updates', 'Get clear reports'];

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="link" onPress={() => router.push('/login')} style={styles.skip}>Skip</Text>
      </View>
      <View style={styles.hero}>
        <Logo size="lg" />
        <Text style={styles.tagline}>Track work. Share updates.{'\n'}Get clear reports.</Text>
      </View>
      <Image source={require('../../../assets/welcome-trail.png')} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />
      <View style={[styles.tiles, shadow]}>
        {TILES.map((t) => (
          <Text key={t} style={styles.tile}>{t}</Text>
        ))}
      </View>
      <Button title="Get started" onPress={() => router.push('/join')} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-end' },
  skip: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 16, padding: 4 },
  hero: { alignItems: 'center', gap: 10 },
  tagline: { fontFamily: fonts.body, fontSize: 18, lineHeight: 25, color: colors.ink500, textAlign: 'center' },
  art: { width: '100%', height: 260 },
  tiles: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 14 },
  tile: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.ink900, paddingHorizontal: 6 },
});
```
"Skip" goes to Sign in, because returning employees skip the introduction (Open Question 3).

`src/app/(auth)/login.tsx`:
```tsx
import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { LoginSchema } from '@worktrail/types';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuthStore } from '../../auth/auth-store';
import { ApiError } from '../../api/client';
import { WEB_URL } from '../../config';
import { colors, fonts } from '../../theme/theme';

type Errors = Partial<Record<'email' | 'password', string>>;

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof Errors] ??= i.message;
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Logo />
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.sub}>Use the email and password you set when you joined.</Text>
      <TextField label="Email address" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@company.com" />
      <TextField label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="current-password" />
      {formError ? <Notice tone="warning">{formError}</Notice> : null}
      <Button title="Sign in" loading={busy} onPress={() => void submit()} />
      <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(`${WEB_URL}/forgot-password`)}>
        Forgot password?
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink900, marginTop: 24 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  link: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 16, textAlign: 'center', padding: 8 },
});
```

`src/app/(auth)/join.tsx`:
```tsx
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AcceptInvitationSchema, type InvitationPreview } from '@worktrail/types';
import { api, ApiError } from '../../api';
import { useAuthStore } from '../../auth/auth-store';
import { extractInviteToken } from '../../auth/invite-token';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, fonts } from '../../theme/theme';

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

export default function JoinScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const [link, setLink] = useState(params.token ?? '');
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'password', string>>>({});
  const [busy, setBusy] = useState(false);

  const lookUp = async () => {
    setError(null);
    const found = extractInviteToken(link);
    if (!found) return setError('Paste the full invite link your admin sent you.');
    setBusy(true);
    try {
      const p = await api.request<InvitationPreview>('GET', `/employees/invitations/${found}`, undefined, { auth: false });
      setToken(found);
      setPreview(p);
      setName(p.employeeName);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setError(null);
    const parsed = AcceptInvitationSchema.safeParse({ name, password });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const i of parsed.error.issues) next[i.path[0] as 'name' | 'password'] ??= i.message;
      return setFieldErrors(next);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await acceptInvite(token!, parsed.data.name, parsed.data.password);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Logo />
      {preview ? (
        <>
          <Text style={styles.title}>Join {preview.companyName}</Text>
          <Text style={styles.sub}>Set a password for {preview.email}. You&apos;ll use it to sign in to this app.</Text>
          <TextField label="Your name" value={name} onChangeText={setName} error={fieldErrors.name} autoComplete="name" />
          <TextField label="Create a password" value={password} onChangeText={setPassword} error={fieldErrors.password} hint="At least 8 characters" secureTextEntry autoComplete="new-password" />
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button title="Join and sign in" loading={busy} onPress={() => void join()} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Join your company</Text>
          <Text style={styles.sub}>Your admin sent you an invite link on WhatsApp or email. Paste it here.</Text>
          <TextField label="Invite link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} multiline placeholder="https://…/invite/…" />
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button title="Continue" loading={busy} onPress={() => void lookUp()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900, marginTop: 24 },
  sub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink500 },
});
```
If the app is opened from a `worktrail://invite/<token>` link, Expo Router delivers the token as a param. Add `src/app/invite/[token].tsx`, which redirects to `/join?token=…`:
```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteDeepLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={{ pathname: '/join', params: { token } }} />;
}
```
For the redirect to work, the jest mock in `test/setup.ts` also needs a `Redirect: () => null`.

- [ ] **Step 4: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS (27 tests).
- [ ] **Step 5: Commit.** `git commit -m "feat(mobile): welcome, sign in and join-with-invite screens with auth gate"`

---

### Task 7: Location permission and one-off location fix (mobile)

**Files:**
- Create: `apps/mobile/src/location/location.ts`, `apps/mobile/src/app/(app)/permissions.tsx`, `apps/mobile/test/location.test.ts`

**Interfaces:**
- Produces:
  - `PermissionState = 'granted'|'undetermined'|'denied'|'blocked'`
  - `getPermission()` and `requestPermission()`, both `Promise<PermissionState>`
  - `FixResult = { ok: true; fix: LocationFix } | { ok: false; reason: 'PERMISSION'|'SERVICES_OFF'|'NO_FIX' }`
  - `currentFix(timeoutMs = 10_000): Promise<FixResult>`
  - Route `/(app)/permissions`

- [ ] **Step 1: Write the failing test.** `test/location.test.ts`:
```ts
import * as Location from 'expo-location';
import { currentFix, requestPermission } from '../src/location/location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));
jest.mock('expo-battery', () => ({ getBatteryLevelAsync: jest.fn(async () => 0.64) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b' }));

const L = Location as jest.Mocked<typeof Location>;
const granted = { granted: true, status: 'granted', canAskAgain: true } as never;
const position = { coords: { latitude: 19.07, longitude: 72.87, accuracy: 12 }, timestamp: Date.parse('2026-10-05T03:30:00Z') } as never;

beforeEach(() => jest.resetAllMocks());

describe('location', () => {
  it('reports a blocked permission so the app can send people to Settings', async () => {
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false } as never);
    await expect(requestPermission()).resolves.toBe('blocked');
  });

  it('returns a full fix with a client point id and battery level', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(true);
    L.getCurrentPositionAsync.mockResolvedValue(position);
    await expect(currentFix()).resolves.toEqual({
      ok: true,
      fix: {
        clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
        latitude: 19.07,
        longitude: 72.87,
        accuracyMeters: 12,
        capturedAt: '2026-10-05T03:30:00.000Z',
        batteryLevel: 0.64,
      },
    });
  });

  it('says when GPS is switched off', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(currentFix()).resolves.toEqual({ ok: false, reason: 'SERVICES_OFF' });
  });

  it('falls back to a recent last-known position, then gives up after the timeout', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(true);
    L.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined) as never);
    L.getLastKnownPositionAsync.mockResolvedValueOnce(position).mockResolvedValueOnce(null as never);
    await expect(currentFix(20)).resolves.toMatchObject({ ok: true });
    await expect(currentFix(20)).resolves.toEqual({ ok: false, reason: 'NO_FIX' });
  });

  it('needs permission before reading location', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true } as never);
    await expect(currentFix()).resolves.toEqual({ ok: false, reason: 'PERMISSION' });
    expect(L.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
```
Run it → FAIL.

- [ ] **Step 2: Implement.** `src/location/location.ts`:
```ts
import * as Battery from 'expo-battery';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import type { LocationFix } from '@worktrail/types';

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';
export type FixResult = { ok: true; fix: LocationFix } | { ok: false; reason: 'PERMISSION' | 'SERVICES_OFF' | 'NO_FIX' };

const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

const toState = (p: Location.LocationPermissionResponse): PermissionState => {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
};

export const getPermission = async () => toState(await Location.getForegroundPermissionsAsync());
export const requestPermission = async () => toState(await Location.requestForegroundPermissionsAsync());

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** One location reading for Start/End work. Never throws; explains why when there's no fix. */
export async function currentFix(timeoutMs = 10_000): Promise<FixResult> {
  if ((await getPermission()) !== 'granted') return { ok: false, reason: 'PERMISSION' };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'SERVICES_OFF' };

  const position =
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs).catch(() => null)) ??
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null));
  if (!position) return { ok: false, reason: 'NO_FIX' };

  const battery = await Battery.getBatteryLevelAsync().catch(() => -1);
  return {
    ok: true,
    fix: {
      clientPointId: randomUUID(),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
      capturedAt: new Date(position.timestamp).toISOString(),
      batteryLevel: battery >= 0 ? battery : null,
    },
  };
}
```

`src/app/(app)/permissions.tsx` (the PRD §7 disclosure):
```tsx
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { requestPermission } from '../../location/location';
import { colors, fonts } from '../../theme/theme';

const POINTS: Array<[string, string]> = [
  ['What', 'Your phone’s location.'],
  ['When', 'Only when you tap Start work and End work. Nothing is recorded while you’re off duty.'],
  ['Why', 'So your company can see where your work day began and ended.'],
  ['Who sees it', 'Your company’s admins on the Work Trail dashboard.'],
  ['How to stop', 'Tap End work. You can also turn location off in Android Settings at any time.'],
];

export default function PermissionsScreen() {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  const allow = async () => {
    const state = await requestPermission();
    if (state === 'granted') return router.back();
    setBlocked(state === 'blocked');
  };

  return (
    <Screen>
      <Text style={styles.title}>How Work Trail uses your location</Text>
      {POINTS.map(([label, body]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
      {blocked ? (
        <>
          <Notice tone="warning">Location is turned off for Work Trail. Open Settings, tap Permissions, then Location, and choose “Allow only while using the app”.</Notice>
          <Button title="Open settings" onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <Button title="Allow location" onPress={() => void allow()} />
      )}
      <Button title="Not now" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink900, marginTop: 8 },
  row: { gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink900 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink700 },
});
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test` → PASS (32 tests).
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): location disclosure and one-off location fix"`

---

### Task 8: Home: start work, end work, live timer and resume (mobile)

**Files:**
- Create: `apps/mobile/src/sessions/session-logic.ts`, `apps/mobile/src/sessions/use-work-session.ts`, `apps/mobile/src/hooks/use-now.ts`, `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/test/session-logic.test.ts`, `apps/mobile/test/screens/home.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `currentFix`, `ActiveSessionResponse`, `SessionMutationResponse`, `WorkSessionDto`.
- Produces:
  - `elapsedMs(startedAt: string, offsetMs: number, now: number): number`
  - `formatElapsed(ms): string` ("1:05:09")
  - `timeLabel(iso, tz): string` ("9:02 AM") and `dayTimeLabel(iso, tz)` ("Sun 4 Oct at 9:02 AM")
  - `isStale(startedAt, now: Date, tz): boolean`
  - `useWorkSession() → { session: WorkSessionDto|null; offsetMs; isLoading; error: ApiError|null; refetch; start(); end(); starting; ending; startNote: string|null }`
  - `useNow(intervalMs): number`

- [ ] **Step 1: Write the failing logic test.** `test/session-logic.test.ts`:
```ts
import { dayTimeLabel, elapsedMs, formatElapsed, isStale, timeLabel } from '../src/sessions/session-logic';

const TZ = 'Asia/Kolkata';

describe('session logic', () => {
  it('formats elapsed time as h:mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00:00');
    expect(formatElapsed(3_909_000)).toBe('1:05:09');
    expect(formatElapsed(-5_000)).toBe('0:00:00');
  });

  it('uses server time, so a wrong phone clock does not change the timer', () => {
    const startedAt = '2026-10-05T03:30:00.000Z';
    const realNow = Date.parse('2026-10-05T04:30:00.000Z');
    const phoneNow = realNow - 3 * 3600_000; // phone is 3 h slow
    const offsetMs = realNow - phoneNow; // measured from serverTime
    expect(elapsedMs(startedAt, offsetMs, phoneNow)).toBe(3600_000);
  });

  it('shows clock times in the company timezone', () => {
    expect(timeLabel('2026-10-05T03:32:00.000Z', TZ)).toBe('9:02 AM');
    expect(dayTimeLabel('2026-10-04T03:32:00.000Z', TZ)).toBe('Sun 4 Oct at 9:02 AM');
  });

  it('treats a session from an earlier day, or older than 14 hours, as left running', () => {
    expect(isStale('2026-10-04T03:30:00.000Z', new Date('2026-10-05T03:00:00Z'), TZ)).toBe(true);
    expect(isStale('2026-10-05T03:30:00.000Z', new Date('2026-10-05T12:00:00Z'), TZ)).toBe(false);
    expect(isStale('2026-10-05T00:30:00.000Z', new Date('2026-10-05T15:00:00Z'), TZ)).toBe(true);
  });
});
```
Run it → FAIL.

- [ ] **Step 2: Implement the logic and hooks.**

`src/sessions/session-logic.ts`:
```ts
import { formatInTimeZone } from 'date-fns-tz';

const STALE_AFTER_MS = 14 * 3600_000;

/** Milliseconds since start, measured on the server clock (offset = serverNow − phoneNow). */
export const elapsedMs = (startedAt: string, offsetMs: number, now: number) =>
  Math.max(0, now + offsetMs - Date.parse(startedAt));

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const timeLabel = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');

/** "Sun 4 Oct at 9:02 AM" — used when a session began on another day. */
export const dayTimeLabel = (iso: string, tz: string) =>
  formatInTimeZone(new Date(iso), tz, "EEE d MMM 'at' h:mm a");

/** A session that started on an earlier day, or long ago, was probably left running by mistake. */
export function isStale(startedAt: string, now: Date, tz: string): boolean {
  const start = new Date(startedAt);
  const differentDay = formatInTimeZone(start, tz, 'yyyy-MM-dd') !== formatInTimeZone(now, tz, 'yyyy-MM-dd');
  return differentDay || now.getTime() - start.getTime() > STALE_AFTER_MS;
}
```

`src/hooks/use-now.ts`:
```ts
import { useEffect, useState } from 'react';

/** Current time, re-rendering every intervalMs (drives the session timer). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

`src/sessions/use-work-session.ts`:
```ts
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActiveSessionResponse, SessionMutationResponse, WorkSessionDto } from '@worktrail/types';
import { api, ApiError } from '../api';
import { currentFix } from '../location/location';

export const ACTIVE_SESSION_KEY = ['sessions', 'active'] as const;

type ActiveView = { session: WorkSessionDto | null; offsetMs: number };

export class NeedsPermissionError extends Error {}
export class LocationOffError extends Error {}

const toView = (r: ActiveSessionResponse | SessionMutationResponse): ActiveView => ({
  session: r.session,
  offsetMs: Date.parse(r.serverTime) - Date.now(),
});

const fetchActive = async () => toView(await api.request<ActiveSessionResponse>('GET', '/sessions/me/active'));

export function useWorkSession() {
  const qc = useQueryClient();
  const [startNote, setStartNote] = useState<string | null>(null);
  const active = useQuery({ queryKey: ACTIVE_SESSION_KEY, queryFn: fetchActive });

  const start = useMutation({
    mutationFn: async (): Promise<ActiveView> => {
      setStartNote(null);
      const fix = await currentFix();
      if (!fix.ok && fix.reason === 'PERMISSION') throw new NeedsPermissionError();
      if (!fix.ok && fix.reason === 'SERVICES_OFF') throw new LocationOffError();
      if (!fix.ok) setStartNote('Work started, but your location couldn’t be found. Move near a window or outside so your end location is recorded.');
      try {
        return toView(
          await api.request<SessionMutationResponse>('POST', '/sessions/start', {
            deviceTime: new Date().toISOString(),
            initialLocation: fix.ok ? fix.fix : undefined,
          }),
        );
      } catch (e) {
        // Already running (double tap or retry): show that session instead of an error.
        if (e instanceof ApiError && e.code === 'SESSION_ALREADY_ACTIVE') return fetchActive();
        throw e;
      }
    },
    onSuccess: (view) => qc.setQueryData(ACTIVE_SESSION_KEY, view),
  });

  const end = useMutation({
    mutationFn: async (sessionId: string): Promise<ActiveView> => {
      const fix = await currentFix();
      try {
        await api.request<SessionMutationResponse>('POST', `/sessions/${sessionId}/end`, {
          deviceTime: new Date().toISOString(),
          finalLocation: fix.ok ? fix.fix : undefined,
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'SESSION_NOT_ACTIVE')) throw e;
      }
      return fetchActive();
    },
    onSuccess: (view) => qc.setQueryData(ACTIVE_SESSION_KEY, view),
  });

  return {
    session: active.data?.session ?? null,
    offsetMs: active.data?.offsetMs ?? 0,
    isLoading: active.isLoading,
    error: (active.error as ApiError | null) ?? null,
    refetch: active.refetch,
    start: start.mutateAsync,
    starting: start.isPending,
    end: end.mutateAsync,
    ending: end.isPending,
    startNote,
  };
}
```

- [ ] **Step 3: Write the failing screen test.** `test/screens/home.test.tsx`:
```tsx
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from '../../src/app/(app)/index';
import { useAuthStore } from '../../src/auth/auth-store';
import { mockRouter } from '../mocks/expo-router';
import * as location from '../../src/location/location';

jest.mock('../../src/location/location');
const loc = location as jest.Mocked<typeof location>;
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const fix = { clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b', latitude: 19.07, longitude: 72.87, accuracyMeters: 12, capturedAt: new Date().toISOString(), batteryLevel: 0.5 };
const session = (startedAt: string) => ({ id: 's1', status: 'ACTIVE', startedAt, endedAt: null, totalMinutes: null, lastLocationAt: startedAt });

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><HomeScreen /></QueryClientProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedIn', accessToken: 'at', user: { id: 'u', role: 'EMPLOYEE', companyId: 'c', name: 'Amit Kumar', email: 'amit@demo.worktrail.in' } });
});

describe('Home', () => {
  it('off duty: Start work captures a location and starts the session', async () => {
    fetchMock
      .mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }))
      .mockReturnValueOnce(json({ session: session(new Date().toISOString()), serverTime: new Date().toISOString() }, 201));
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('At work')).toBeOnTheScreen();
    const body = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(body.initialLocation.clientPointId).toBe(fix.clientPointId);
  });

  it('sends people to the disclosure screen when location permission is missing', async () => {
    fetchMock.mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }));
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'PERMISSION' });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/permissions'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks to turn on GPS when location services are off', async () => {
    fetchMock.mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }));
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'SERVICES_OFF' });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('Turn on location (GPS) on your phone, then tap Start work again.')).toBeOnTheScreen();
  });

  it('a double tap resumes the running session instead of showing an error', async () => {
    const running = session(new Date().toISOString());
    fetchMock
      .mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }))
      .mockReturnValueOnce(json({ error: { code: 'SESSION_ALREADY_ACTIVE', message: 'x', details: { session: running } } }, 409))
      .mockReturnValueOnce(json({ session: running, serverTime: new Date().toISOString() }));
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('At work')).toBeOnTheScreen();
  });

  it('at work: shows the timer from server time and ends work after confirming', async () => {
    const started = new Date(Date.now() - 65 * 60_000).toISOString();
    fetchMock
      .mockReturnValueOnce(json({ session: session(started), serverTime: new Date().toISOString() }))
      .mockReturnValueOnce(json({ session: { ...session(started), status: 'COMPLETED' }, serverTime: new Date().toISOString() }))
      .mockReturnValueOnce(json({ session: null, serverTime: new Date().toISOString() }));
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'End work')?.onPress?.());
    renderHome();
    expect(await screen.findByText(/^1:0[45]:\d\d$/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'End work' }));
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/sessions\/s1\/end$/);
  });

  it('offers to end a session left running from an earlier day', async () => {
    const yesterday = new Date(Date.now() - 26 * 3600_000).toISOString();
    fetchMock.mockReturnValueOnce(json({ session: session(yesterday), serverTime: new Date().toISOString() }));
    renderHome();
    expect(await screen.findByText(/haven’t ended it/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Keep working' })).toBeOnTheScreen();
  });

  it('shows a retry when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    renderHome();
    expect(await screen.findByText('You appear to be offline. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
```
Run it → FAIL.

- [ ] **Step 4: Implement the screens.**

`src/app/(app)/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="permissions" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
```

`src/app/(app)/index.tsx`:
```tsx
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { StatusPill } from '../../components/StatusPill';
import { useAuthStore } from '../../auth/auth-store';
import { useNow } from '../../hooks/use-now';
import { dayTimeLabel, elapsedMs, formatElapsed, isStale, timeLabel } from '../../sessions/session-logic';
import { LocationOffError, NeedsPermissionError, useWorkSession } from '../../sessions/use-work-session';
import { colors, fonts, radius, shadow } from '../../theme/theme';

// The company timezone arrives with /me in Task 9; Indian SMEs default to IST.
const TZ = 'Asia/Kolkata';

export default function HomeScreen() {
  const router = useRouter();
  const firstName = useAuthStore((s) => s.user?.name.split(' ')[0] ?? '');
  const work = useWorkSession();
  const now = useNow(1000);
  const [message, setMessage] = useState<string | null>(null);
  const [keepWorking, setKeepWorking] = useState(false);

  const startWork = async () => {
    setMessage(null);
    try {
      await work.start();
    } catch (e) {
      if (e instanceof NeedsPermissionError) return router.push('/permissions');
      if (e instanceof LocationOffError) return setMessage('Turn on location (GPS) on your phone, then tap Start work again.');
      setMessage(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  };

  const endWork = (sessionId: string) =>
    Alert.alert('End work?', 'Your work time stops now and your end location is recorded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End work',
        style: 'destructive',
        onPress: () => void work.end(sessionId).catch((e: Error) => setMessage(e.message)),
      },
    ]);

  const header = (
    <View style={styles.header}>
      <Logo />
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')} hitSlop={10}>
        <Text style={styles.profile}>Profile</Text>
      </Pressable>
    </View>
  );

  if (work.isLoading) return <Screen>{header}</Screen>;

  if (work.error && !work.session) {
    return (
      <Screen>
        {header}
        <Notice tone="warning">{work.error.message}</Notice>
        <Button title="Try again" onPress={() => void work.refetch()} />
      </Screen>
    );
  }

  const s = work.session;
  const stale = Boolean(s) && !keepWorking && isStale(s!.startedAt, new Date(now + work.offsetMs), TZ);
  return (
    <Screen>
      {header}
      <Text style={styles.greeting}>Hi {firstName}</Text>

      {s ? (
        <View style={[styles.card, shadow]}>
          <StatusPill tone="working" label="At work" />
          <Text accessibilityLabel="Time at work" style={styles.timer}>{formatElapsed(elapsedMs(s.startedAt, work.offsetMs, now))}</Text>
          <Text style={styles.meta}>Started at {timeLabel(s.startedAt, TZ)}</Text>
          <Text style={styles.meta}>
            {s.lastLocationAt
              ? `Location recorded at ${timeLabel(s.lastLocationAt, TZ)}`
              : 'Start location wasn’t recorded'}
          </Text>
          {stale ? (
            <Notice tone="warning">
              You started work on {dayTimeLabel(s.startedAt, TZ)} and haven’t ended it. End it now if you forgot.
            </Notice>
          ) : null}
          <Button title="End work" loading={work.ending} onPress={() => endWork(s.id)} />
          {stale ? <Button title="Keep working" variant="secondary" onPress={() => setKeepWorking(true)} /> : null}
        </View>
      ) : (
        <View style={[styles.card, shadow]}>
          <StatusPill tone="off" label="Off duty" />
          <Text style={styles.title}>Ready to start your day?</Text>
          <Text style={styles.body}>Your location is recorded only when you start and end work.</Text>
          <Button title="Start work" loading={work.starting} onPress={() => void startWork()} />
          <Text accessibilityRole="link" style={styles.link} onPress={() => router.push('/permissions')}>
            How Work Trail uses your location
          </Text>
        </View>
      )}

      {work.startNote ? <Notice>{work.startNote}</Notice> : null}
      {message ? <Notice tone="warning">{message}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profile: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  greeting: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink900 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink700 },
  timer: { fontFamily: fonts.display, fontSize: 56, color: colors.ink900, fontVariant: ['tabular-nums'] },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500 },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand700, textAlign: 'center', padding: 6 },
});
```
Stale-banner copy check: the test looks for the word "haven’t ended it" (curly apostrophe, the same character used in the screen). Keep the apostrophe the same in both files.

- [ ] **Step 5: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS (39 tests).
- [ ] **Step 6: Commit.** `git commit -m "feat(mobile): start/end work with live server-time timer and resume of forgotten sessions"`

---

### Task 9: Profile and sign out (mobile)

**Files:**
- Create: `apps/mobile/src/app/(app)/profile.tsx`, `apps/mobile/test/screens/profile.test.tsx`
- Modify: `apps/mobile/src/app/(app)/index.tsx`, which uses the company timezone from `/me` when loaded (replacing the `TZ` constant with `me.data?.company.timezone ?? 'Asia/Kolkata'`)

**Interfaces:**
- Consumes: `MeResponse`, `useWorkSession`, `useAuthStore.signOut`.
- Produces: route `/(app)/profile`, and `useMe()` (exported from `profile.tsx`'s neighbour `src/auth/use-me.ts`).

- [ ] **Step 1: Write the failing test.** `test/screens/profile.test.tsx`:
```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileScreen from '../../src/app/(app)/profile';
import { useAuthStore } from '../../src/auth/auth-store';
import * as location from '../../src/location/location';

jest.mock('../../src/location/location');
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const me = {
  user: { id: 'u', role: 'EMPLOYEE', companyId: 'c', name: 'Amit Kumar', email: 'amit@demo.worktrail.in' },
  employee: { id: 'e', name: 'Amit Kumar', designation: 'Field Sales Executive', employeeCode: 'FT-101', phone: '+919800000110' },
  company: { name: 'Demo Field Services Pvt Ltd', timezone: 'Asia/Kolkata' },
};

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ProfileScreen /></QueryClientProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  (location.currentFix as jest.Mock).mockResolvedValue({ ok: false, reason: 'NO_FIX' });
});

describe('Profile', () => {
  it('shows who you are and where you work', async () => {
    const signOut = jest.fn();
    useAuthStore.setState({ signOut });
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/me') ? json(me) : json({ session: null, serverTime: new Date().toISOString() }),
    );
    renderProfile();
    expect(await screen.findByText('Field Sales Executive')).toBeOnTheScreen();
    expect(screen.getByText('Demo Field Services Pvt Ltd')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('ends work before signing out when a session is running', async () => {
    const signOut = jest.fn();
    useAuthStore.setState({ signOut });
    const running = { id: 's1', status: 'ACTIVE', startedAt: new Date().toISOString(), endedAt: null, totalMinutes: null, lastLocationAt: null };
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(me);
      if (url.endsWith('/sessions/s1/end')) return json({ session: { ...running, status: 'COMPLETED' }, serverTime: new Date().toISOString() });
      return json({ session: running, serverTime: new Date().toISOString() });
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'End work and sign out')?.onPress?.());
    renderProfile();
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/sessions/s1/end'))).toBe(true);
  });
});
```
Run it → FAIL.

- [ ] **Step 2: Implement.** `src/auth/use-me.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@worktrail/types';
import { api } from '../api';

export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api.request<MeResponse>('GET', '/me'), staleTime: 5 * 60_000 });
```

`src/app/(app)/profile.tsx`:
```tsx
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { useAuthStore } from '../../auth/auth-store';
import { useMe } from '../../auth/use-me';
import { useWorkSession } from '../../sessions/use-work-session';
import { colors, fonts, radius, shadow } from '../../theme/theme';

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const me = useMe();
  const work = useWorkSession();
  const signOut = useAuthStore((s) => s.signOut);

  const onSignOut = () => {
    const s = work.session;
    if (!s) return void signOut();
    Alert.alert('You’re still at work', 'End your work session before signing out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End work and sign out', style: 'destructive', onPress: () => void work.end(s.id).then(() => signOut()) },
    ]);
  };

  const m = me.data;
  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>Back</Text>
      <Text style={styles.title}>{m?.user.name ?? 'Profile'}</Text>
      <View style={[styles.card, shadow]}>
        <Row label="Email" value={m?.user.email} />
        <Row label="Designation" value={m?.employee?.designation} />
        <Row label="Employee ID" value={m?.employee?.employeeCode} />
        <Row label="Company" value={m?.company.name} />
      </View>
      <Notice>
        Your location is recorded only when you start and end work, and only your company’s admins can see it.
      </Notice>
      <Button title="Sign out" variant="secondary" loading={work.ending} onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 14 },
  row: { gap: 2 },
  label: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  value: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink900 },
});
```
In `src/app/(app)/index.tsx`, delete the `const TZ = …` line. Add `const me = useMe();` and `const TZ = me.data?.company.timezone ?? 'Asia/Kolkata';` inside the component, and import `useMe`. In the home tests, make the mocked `fetch` answer `/me` URLs with the profile JSON; the simplest way is to route `url.endsWith('/me')` in a `mockImplementation`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck` → PASS (41 tests).
- [ ] **Step 4: Commit.** `git commit -m "feat(mobile): profile with privacy note and safe sign out"`

---

### Task 10: Check it on a real Android phone

**Files:** none. If something breaks, write a failing test in the owning task's test file, fix it, and commit as `fix(mobile|api): …`.

- [ ] **Step 1: Start the backend with low memory use.**
```bash
pnpm db:up
pnpm --filter @worktrail/api build && (cd apps/api && pnpm db:seed && node scripts/with-env.mjs node dist/main.js) &
pnpm --filter @worktrail/web build && (cd apps/web && pnpm start) &
```
Expected: `curl -s http://<LAN-IP>:4000/api/v1/health` returns `{"status":"ok","db":"up"}` **from the phone's browser**. If it times out, allow Node.js through Windows Firewall on private networks.

- [ ] **Step 2: Run the app.** Phase 2 uses no native code outside Expo Go, so:
```bash
cd apps/mobile && pnpm start
```
Scan the QR code with **Expo Go** on the Android phone (same Wi-Fi). If Expo Go's SDK doesn't match SDK 57, plug in the phone with USB debugging on and run `pnpm expo run:android` instead. The Android SDK is already installed at `%LOCALAPPDATA%\Android\Sdk`.

- [ ] **Step 3: Walk the flows.**
1. The welcome screen matches `Landing page.png`: logo, tagline, illustration, tiles, Get started and Sign in.
2. **Sign in** as `rahul@…`, the admin. Expected: "This app is for field employees…".
3. Sign in as `amit@demo.worktrail.in` / `WorkTrail@demo1`. The seed left Amit with a running session from 09:00 IST, so home shows **At work** with the timer, or the "haven't ended it" banner if it's after 23:00 IST or the next day.
4. **End work** → confirm → **Off duty**. On the website dashboard (`http://localhost:3000`, admin), "Working now" drops by one after a refresh.
5. **Start work.** The first time, Android asks for location, after the disclosure screen. Expected: **At work**, a timer counting from 0:00:0x and "Location recorded at …". The website's map shows Amit's new pin and "Working now" goes up by one.
6. Tap **Start work** twice quickly from Off duty. Expected: one session, and no error.
7. Turn off GPS, End work, then Start work. Expected: "Turn on location (GPS)…".
8. Turn on airplane mode and kill the app, then reopen it. Expected: "Can't reach Work Trail" and **Try again**. Turn airplane mode off and tap Try again → back home, still signed in.
9. **Profile** → **Sign out** while at work. Expected: "End work and sign out" ends the session (the dashboard shows Amit off duty) and returns to Welcome.
10. On the website, invite a new employee and copy the link. In the app go to **Get started**, paste the WhatsApp text, set a password and join. Expected: home, Off duty, signed in as the new employee.

- [ ] **Step 4: Run the full suite.** Run `pnpm test`. Expected: every workspace passes. Record in the ledger the device model, Android version and anything the OS did differently.

---

## Open Questions (each has a default; tell me if any is wrong)

1. **Expo Go vs. a development build for testing.** *Default: Expo Go for Phase 2, since it needs no build step. Phase 3 (background location) requires a development build or APK.* Do you want an APK build already in Phase 2, for example to share with a pilot company?
2. **App identity.** *Default: name "Work Trail", Android package `in.worktrail.app`, deep-link scheme `worktrail://`.* The package name can't change after the first Play Store release, so tell me if you own a different domain.
3. **Welcome screen buttons.** *Default: **Get started** → Join with invite link, **Sign in** → Login, **Skip** → Login.*
4. **Forgot password in the app.** *Default: opens the website's reset page in the phone browser (already built and tested). There is no separate in-app reset flow.*
5. **Location at Start when no fix is found indoors.** *Default: work still starts, without a start point, and the app says so. The alternative is to block Start until a fix arrives, which can strand people indoors.*
6. **The phone's API address.** *Default: your PC's Wi-Fi address (`192.168.1.108` from earlier logs) in `apps/mobile/.env`.* It changes if your router assigns a new IP. You'll want a public HTTPS API once we deploy (Phase 7).
