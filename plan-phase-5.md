# Work Trail Phase 5: Admin Employee Detail, Route Map and Work Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a page for each employee where they pick a period (Today, Yesterday, This week, Last week, This month or Custom). On that page they can:
- see the employee's route on a map, with start and end markers, low-accuracy warnings and gaps where no location arrived;
- read the employee's updates;
- check hours per day.

A company-wide **Work sessions** page lists every session. On it, an admin can close a session an employee forgot to end.

**Architecture:**
- **API:** a new `employee-activity` module in the same MVC layout. It covers:
  - an access service, so every lookup stays inside the admin's company and other companies' ids get 404;
  - `sessions`, `summary`, `updates` and `location-trail` endpoints under `/employees/:employeeId/…`;
  - a company-wide `GET /work-sessions` list;
  - an audited `close` action.
- **Calculations:** gaps and distance are pure functions in `common/utils/trail.ts` and `geo.ts`, so they are easy to unit-test and Phase 6's PDF can reuse them.
- **Website:** nested routes under `/app/employees/[id]` (Overview, Map, Updates, Work hours) share a layout with a header, tab bar and period picker. The period lives in the URL. The map draws the trail with MapLibre GeoJSON layers built by a pure `trailToGeoJson()`.
- **No mobile changes.** When an admin closes a session, the Phase 3 app notices on its next sync and stops tracking.

**Tech Stack:** Same as before. API: NestJS 12 + Prisma 6 + PostgreSQL. Web: Next.js 16 (App Router, Server Actions), Tailwind 4, `react-map-gl/maplibre` (already installed), `date-fns`/`date-fns-tz`. Tests: Vitest (+ supertest, Testing Library).

**Spec:**
- `docs/specs/prd.pdf` §3 "Admin review" steps 1–4; §4 "Admin dashboard" (employee list, employee profile tabs) and "Maps" (all bullets); §4 "Work session" ("Admin can see active, ended, and incomplete sessions"); §5 routes `/app/employees/:id`.
- `docs/specs/api-contract.pdf`: `GET /employees/:employeeId`, `GET /employees/:employeeId/sessions?from=&to=`, `GET /employees/:employeeId/location-trail?from=&to=`, `GET /employees/:employeeId/updates?from=&to=&page=1&pageSize=50`.
- `docs/specs/data-model.pdf`: `work_sessions.status` (ACTIVE, COMPLETED, INCOMPLETE), `audit_logs` ("session overrides").
- `docs/specs/First 3 screens.png`: sidebar items "Employees" and "Work Sessions", and the card and table style.
- `plan.md` (Design System, Phase 5 outline), plus `plan-phase-1b.md` through `plan-phase-4.md`.

**Assumes Phases 1b–4 are complete:** the employees list, sessions, location points with quality flags, work updates with categories, `CurrentEmployeeService`, `HistoryQuerySchema`, and the dashboard showing category.

---

## What we're building (plain summary)

**Employee page `/app/employees/[id]`** (opened from the Employees table, the dashboard's people list, Recent updates and Today's work hours)
- **Header:**
  - Avatar, name, designation, employee ID, email, phone and status ("Working since 9:02 AM", "Off duty · last seen 6:10 PM", or "Invite pending").
  - Period picker: Today · Yesterday · This week · Last week · This month · Custom (up to 31 days).
- **Overview tab:**
  - Four cards for the period: Hours worked, Days worked, Updates, Distance covered.
  - The 5 latest updates.
  - A "Left running" warning if a session from an earlier day is still open.
- **Map tab:**
  - The route as an orange line per session, with a green **S** at the start and a dark **E** at the end, and small dots for each recorded location.
  - Low-accuracy points are drawn hollow and grey.
  - Gaps longer than 15 minutes are drawn as dashed grey lines and listed ("No location for 42 min · 1:10 PM – 1:52 PM").
  - Clicking a point shows its time, accuracy, speed and source.
  - Above the map: "28 locations · 3.4 km · 2 gaps". If over 20% of points are low accuracy: "Some locations are approximate (accuracy worse than 100 m)."
  - With no points: "No locations recorded in this period."
- **Updates tab:** every update in the period, with time, category, a "Voice" tag and the full text. It can be filtered by category and pages 50 at a time. AI summaries come in Phase 6.
- **Work hours tab:**
  - A day-by-day table (date, sessions such as "9:02 AM – 6:10 PM", hours) and a total row.
  - Sessions still open from earlier days are marked **Left running**, with a **Close session** button. The admin picks the end time, which defaults to the last recorded location. The session becomes "Closed by admin" and the action is written to the audit log.

**Work sessions page `/app/sessions`** (the sidebar item from the mockup)
- A table of every session in the company: employee, date, start, end, duration, locations recorded and status (Active, Completed, Left running, Closed by admin).
- Filters: period, status and employee name, with pagination.

**Small changes elsewhere**
- Employee names in the Employees table and on the dashboard become links to the employee page.

**API**

| Endpoint | Returns |
|---|---|
| `GET /employees/:id` | Now also phone, joined date, "working since" and "last seen". |
| `GET /employees/:id/summary?from&to` | Totals for the Overview cards. |
| `GET /employees/:id/sessions?from&to` | Sessions overlapping the period, minutes per day, total. |
| `GET /employees/:id/location-trail?from&to` | Time-ordered points, session start/end, gaps, stats. Capped at 5,000 points, with a `truncated` flag. |
| `GET /employees/:id/updates?from&to&category&page&pageSize` | Paged updates, newest first. |
| `POST /employees/:id/sessions/:sessionId/close` | `{ endedAt }` → status `INCOMPLETE`, audited. |
| `GET /work-sessions?from&to&status&query&page&pageSize` | The company-wide session list. |

**Not in Phase 5:** AI summaries and PDF reports (Phase 6), the Reports tab (Phase 6), editing sessions beyond closing a forgotten one, and deleting data (Phase 7 retention).

---

## Files to create and change

### Changed files

| File | What changes |
|---|---|
| `packages/types/src/history.ts` | Move the date-range validation into the new `ranges.ts`. `HistoryQuerySchema` becomes `export const HistoryQuerySchema = DateRangeSchema`, so Phase 4 code keeps working. |
| `packages/types/src/index.ts` | Export `ranges.ts` and `employee-activity.ts`. |
| `apps/api/src/common/audit/audit.service.ts` | `AuditAction` gains `'session.closed_by_admin'`. `entityType` gains `'session'`. |
| `apps/api/src/modules/employees/services/employees.service.ts` | `get()` returns `EmployeeDetail` (adds `phone`, `joinedAt`, `workingSince`, `lastSeenAt`). |
| `apps/api/test/e2e/isolation.e2e-spec.ts` | Asserts the detail fields. |
| `apps/api/src/app.module.ts` | Import `EmployeeActivityModule`. |
| `apps/api/prisma/seed.ts` | The 5th demo employee (Vikram) gets one session left running from 2 days ago and a 40-minute gap mid-route, so the Left-running and gap features have demo data. |
| `apps/web/src/components/employees/employee-table.tsx` | The name links to `/app/employees/{id}`. |
| `apps/web/src/components/dashboard/locations-card.tsx`, `recent-updates.tsx`, `work-hours.tsx` | Names link to the employee page. |
| `apps/web/src/components/shell/sidebar.tsx` | No change; "Work sessions" already points to `/app/sessions`, which now exists. |
| `apps/web/test/employees.test.tsx`, `apps/web/test/dashboard.test.tsx` | Assert the links. |

### New files

```
packages/types/src/ranges.ts                    DateRangeSchema (+ checkRange helper), IsoDateSchema
packages/types/src/employee-activity.ts         EmployeeDetail, EmployeeSummary, AdminSessionDto, EmployeeSessionsResponse,
                                                TrailPoint, TrailGap, TrailStats, LocationTrailResponse,
                                                EmployeeUpdatesQuerySchema/Response, CloseSessionSchema,
                                                WorkSessionsQuerySchema/Row/Response, LEFT_RUNNING_AFTER_MS, sessionLabel()
packages/types/test/employee-activity.test.ts

apps/api/src/common/utils/geo.ts                haversineKm()
apps/api/src/common/utils/trail.ts             GAP_MS, findGaps(), distanceKm()
apps/api/src/modules/employee-activity/employee-activity.module.ts
apps/api/src/modules/employee-activity/services/employee-access.service.ts    company-scoped employee lookup (404)
apps/api/src/modules/employee-activity/services/activity.service.ts           sessions, summary, updates
apps/api/src/modules/employee-activity/services/trail.service.ts              location trail
apps/api/src/modules/employee-activity/services/close-session.service.ts      admin close + audit
apps/api/src/modules/employee-activity/services/work-sessions.service.ts      company-wide list
apps/api/src/modules/employee-activity/controllers/employee-activity.controller.ts   /employees/:employeeId/...
apps/api/src/modules/employee-activity/controllers/work-sessions.controller.ts       /work-sessions
apps/api/test/unit/trail.spec.ts
apps/api/test/e2e/employee-activity.e2e-spec.ts
apps/api/test/e2e/employee-trail.e2e-spec.ts
apps/api/test/e2e/work-sessions.e2e-spec.ts

apps/web/src/lib/date-range.ts                  presets, parseRange(), rangeHref()
apps/web/src/lib/trail-geojson.ts               trailToGeoJson()
apps/web/src/app/app/employees/[id]/layout.tsx          header + tabs + range picker
apps/web/src/app/app/employees/[id]/page.tsx            Overview
apps/web/src/app/app/employees/[id]/map/page.tsx
apps/web/src/app/app/employees/[id]/updates/page.tsx
apps/web/src/app/app/employees/[id]/hours/page.tsx
apps/web/src/app/app/employees/[id]/actions.ts          closeSession server action
apps/web/src/app/app/employees/[id]/loading.tsx
apps/web/src/app/app/sessions/page.tsx
apps/web/src/components/employee-detail/employee-header.tsx
apps/web/src/components/employee-detail/tab-nav.tsx
apps/web/src/components/employee-detail/range-picker.tsx
apps/web/src/components/employee-detail/overview-cards.tsx
apps/web/src/components/employee-detail/trail-map.tsx
apps/web/src/components/employee-detail/trail-summary.tsx
apps/web/src/components/employee-detail/updates-list.tsx
apps/web/src/components/employee-detail/hours-table.tsx
apps/web/src/components/employee-detail/close-session-dialog.tsx
apps/web/src/components/sessions/sessions-table.tsx
apps/web/src/components/sessions/sessions-filters.tsx
apps/web/test/date-range.test.ts
apps/web/test/trail-geojson.test.ts
apps/web/test/employee-detail.test.tsx
apps/web/test/sessions.test.tsx
```

---

## Global Constraints

- Everything in `plan.md` → Global Constraints and the earlier phase plans still applies, especially: every query is scoped to the admin's company, another company's id gets **404**, and there is never "live" wording.
- "Employee profile tabs: Overview, Map, Updates, Work hours, Reports" (PRD §4). Phase 5 builds the first four. Reports is added in Phase 6.
- "Date-range presets: Today, Yesterday, This week, Last week, This month, Custom range" (PRD §4 Maps). Weeks start on **Monday**. All dates are in the company timezone (default `Asia/Kolkata`). Custom is limited to **31 days**.
- "Map draws chronological point trail as a polyline; start/end markers; point/segment timestamps on inspection" (PRD §4).
- "Display location confidence using accuracy metadata; do not overstate accuracy" (PRD §4). `LOW_ACCURACY` and `SUSPICIOUS` points are drawn differently and are left out of the distance.
- "Show data gaps where no locations were received for a meaningful period" (PRD §4). Meaningful means **more than 15 minutes** (three missed 5-minute targets), measured within a session, including from start to the first point and from the last point to end (or now).
- "Default map is centred on available employee locations; never expose a map to unauthorised users" (PRD §4). The map fits to the trail's points, and every trail request is company-scoped and admin-only.
- "Admin can see active, ended, and incomplete sessions" (PRD §4). Labels:

  | Session | Label |
  |---|---|
  | ACTIVE started less than 14 h ago | Active |
  | ACTIVE started 14 h ago or more | Left running |
  | COMPLETED | Completed |
  | INCOMPLETE (closed by an admin) | Closed by admin |

- Audit "session overrides" (data-model `audit_logs`). Closing a session records actor, session and chosen end time.
- Admin-only: every new endpoint is `@Roles('OWNER', 'ADMIN')`.
- Pagination and limits: updates 50 per page (max 100). Work sessions 25 per page (max 100). Trail at most 5,000 points, with a `truncated` flag shown in the UI.
- Low memory: verify with the production web build (`next build && next start`), not `next dev` plus Metro.

## Review Focus

1. **Another company's employee or session id on every new endpoint**, including the close action.
   - Expected: 404 with no data, and nothing is changed.
   - Test in Task 3 (loops over every route).
2. **Period edges in IST.**
   - "This week" opened Monday 00:15 IST covers that Monday only, not the previous week.
   - A session from 23:30 to 00:30 counts 30 minutes on each day.
   - Custom ranges over 31 days or reversed are refused with a clear message.
   - Tests in Task 1, Task 3 and Task 7.
3. **Odd trails:** no points, one point, all low-accuracy, a jump of 200 km in 5 minutes (a GPS glitch), or a session with no points at all.
   - Expected: the map doesn't crash and shows a plain message. Distance ignores impossible jumps and approximate points. A whole session with no locations is one gap.
   - Tests in Task 2, Task 4 and Task 8.
4. **An admin closes a session the phone is still tracking.**
   - Expected: status INCOMPLETE. Points captured after the chosen end are rejected by the Phase 3 window check. The employee's app stops tracking on its next sync.
   - Closing twice gives 409. An end time before the start or in the future is refused.
   - Test in Task 5.
5. **A busy month:** about 4,000 points and 300 updates.
   - Expected: the map loads (up to 5,000, otherwise "Showing the first 5,000 locations") and updates are paged.
   - Tests in Task 4 (cap) and Task 3 (pagination).

---

### Task 1: Shared types for ranges and employee activity

**Files:**
- Create: `packages/types/src/ranges.ts`, `packages/types/src/employee-activity.ts`, `packages/types/test/employee-activity.test.ts`
- Modify: `packages/types/src/history.ts`, `packages/types/src/index.ts`

**Interfaces:**
- Produces:
  - `IsoDateSchema`
  - `checkRange(schema)`, which adds the to ≥ from and ≤ 31 days rules
  - `DateRangeSchema` → `DateRange { from; to }`
  - `EmployeeDetail = EmployeeListItem & { phone: string|null; joinedAt: string; workingSince: string|null; lastSeenAt: string|null }`
  - `EmployeeSummary { from; to; totalMinutes; daysWorked; updateCount; pointCount; distanceKm; lastSeenAt: string|null; leftRunning: boolean }`
  - `AdminSessionDto = WorkSessionDto & { pointCount: number; leftRunning: boolean }`
  - `DayMinutes { date; minutes }`
  - `EmployeeSessionsResponse { timezone; sessions: AdminSessionDto[]; days: DayMinutes[]; totalMinutes }`
  - `TrailPoint { id; sessionId; latitude; longitude; accuracyMeters: number|null; speedMps: number|null; capturedAt; source: 'START'|'BACKGROUND'|'END'|'MANUAL'; qualityFlag: 'GOOD'|'LOW_ACCURACY'|'SUSPICIOUS'|'INVALID' }`
  - `TrailGap { sessionId; from; to; minutes }`
  - `TrailStats { pointCount; lowAccuracyCount; gapCount; distanceKm }`
  - `TrailSession { id; status; startedAt; endedAt: string|null }`
  - `LocationTrailResponse { timezone; sessions: TrailSession[]; points: TrailPoint[]; gaps: TrailGap[]; stats: TrailStats; truncated: boolean }`
  - `EmployeeUpdatesQuerySchema` (range plus `category?`, `page`=1, `pageSize`=50, max 100)
  - `EmployeeUpdatesResponse { items: WorkUpdateDto[]; page; pageSize; total }`
  - `CloseSessionSchema { endedAt }`
  - `WORK_SESSION_FILTERS = ['ACTIVE','COMPLETED','LEFT_RUNNING','CLOSED'] as const`
  - `WorkSessionsQuerySchema` (range plus `status?`, `query?`, `page`=1, `pageSize`=25, max 100)
  - `WorkSessionRow = AdminSessionDto & { employeeId; employeeName }`
  - `WorkSessionsResponse { timezone; items: WorkSessionRow[]; page; pageSize; total }`
  - `LEFT_RUNNING_AFTER_MS = 14h`
  - `sessionLabel(s: { status; leftRunning }): 'Active'|'Left running'|'Completed'|'Closed by admin'`

- [ ] **Step 1: Write the failing test.** `packages/types/test/employee-activity.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  CloseSessionSchema,
  DateRangeSchema,
  EmployeeUpdatesQuerySchema,
  HistoryQuerySchema,
  WorkSessionsQuerySchema,
  sessionLabel,
} from '../src/index.js';

describe('ranges', () => {
  it('shares one rule set between history, updates and work sessions', () => {
    for (const s of [DateRangeSchema, HistoryQuerySchema, EmployeeUpdatesQuerySchema, WorkSessionsQuerySchema]) {
      expect(s.safeParse({ from: '2026-10-06', to: '2026-10-01' }).error?.issues[0]?.message).toBe('The end date must be on or after the start date.');
      expect(s.safeParse({ from: '2026-08-01', to: '2026-10-06' }).error?.issues[0]?.message).toBe('Choose at most 31 days.');
    }
  });

  it('coerces paging from query strings and applies defaults', () => {
    expect(EmployeeUpdatesQuerySchema.parse({ from: '2026-10-01', to: '2026-10-07', page: '2' })).toMatchObject({ page: 2, pageSize: 50 });
    expect(WorkSessionsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-07' })).toMatchObject({ page: 1, pageSize: 25 });
    expect(WorkSessionsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', pageSize: '500' }).success).toBe(false);
  });

  it('rejects an unknown status or category filter', () => {
    expect(WorkSessionsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', status: 'LOST' }).success).toBe(false);
    expect(EmployeeUpdatesQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-07', category: 'PARTY' }).success).toBe(false);
  });
});

describe('sessionLabel', () => {
  it.each([
    [{ status: 'ACTIVE', leftRunning: false }, 'Active'],
    [{ status: 'ACTIVE', leftRunning: true }, 'Left running'],
    [{ status: 'COMPLETED', leftRunning: false }, 'Completed'],
    [{ status: 'INCOMPLETE', leftRunning: false }, 'Closed by admin'],
  ] as const)('%o → %s', (s, label) => {
    expect(sessionLabel(s)).toBe(label);
  });
});

describe('CloseSessionSchema', () => {
  it('needs an ISO end time', () => {
    expect(CloseSessionSchema.safeParse({ endedAt: 'yesterday' }).success).toBe(false);
  });
});
```
Run `pnpm --filter @worktrail/types test` → FAIL.

- [ ] **Step 2: Implement.** `packages/types/src/ranges.ts`:
```ts
import { z } from 'zod';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in the format YYYY-MM-DD.');
export const MAX_RANGE_DAYS = 31;
const DAY_MS = 86_400_000;

const dayDiff = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;

/** Adds the shared period rules to any object schema that has from/to. */
export function checkRange<T extends z.ZodObject<{ from: typeof IsoDateSchema; to: typeof IsoDateSchema }>>(schema: T) {
  return schema
    .refine((q) => q.to >= q.from, { message: 'The end date must be on or after the start date.', path: ['to'] })
    .refine((q) => dayDiff(q.from, q.to) < MAX_RANGE_DAYS, { message: `Choose at most ${MAX_RANGE_DAYS} days.`, path: ['from'] });
}

export const rangeShape = { from: IsoDateSchema, to: IsoDateSchema };
export const DateRangeSchema = checkRange(z.object(rangeShape));
export type DateRange = z.output<typeof DateRangeSchema>;
```
In `history.ts`, delete the local `IsoDate`/`HistoryQuerySchema` definition and write:
```ts
import { DateRangeSchema } from './ranges.js';
export const HistoryQuerySchema = DateRangeSchema;
export type HistoryQuery = z.output<typeof HistoryQuerySchema>;
```
(keep `HistoryResponse` unchanged).

`packages/types/src/employee-activity.ts`:
```ts
import { z } from 'zod';
import type { EmployeeListItem } from './employees.js';
import { checkRange, rangeShape } from './ranges.js';
import type { SessionStatus, WorkSessionDto } from './sessions.js';
import { UPDATE_CATEGORIES, type WorkUpdateDto } from './updates.js';

export const LEFT_RUNNING_AFTER_MS = 14 * 3600_000;

export type EmployeeDetail = EmployeeListItem & {
  phone: string | null;
  joinedAt: string;
  workingSince: string | null;
  lastSeenAt: string | null;
};

export type EmployeeSummary = {
  from: string;
  to: string;
  totalMinutes: number;
  daysWorked: number;
  updateCount: number;
  pointCount: number;
  distanceKm: number;
  lastSeenAt: string | null;
  leftRunning: boolean;
};

export type AdminSessionDto = WorkSessionDto & { pointCount: number; leftRunning: boolean };
export type DayMinutes = { date: string; minutes: number };
export type EmployeeSessionsResponse = { timezone: string; sessions: AdminSessionDto[]; days: DayMinutes[]; totalMinutes: number };

export type TrailPoint = {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  capturedAt: string;
  source: 'START' | 'BACKGROUND' | 'END' | 'MANUAL';
  qualityFlag: 'GOOD' | 'LOW_ACCURACY' | 'SUSPICIOUS' | 'INVALID';
};
export type TrailGap = { sessionId: string; from: string; to: string; minutes: number };
export type TrailStats = { pointCount: number; lowAccuracyCount: number; gapCount: number; distanceKm: number };
export type TrailSession = { id: string; status: SessionStatus; startedAt: string; endedAt: string | null };
export type LocationTrailResponse = {
  timezone: string;
  sessions: TrailSession[];
  points: TrailPoint[];
  gaps: TrailGap[];
  stats: TrailStats;
  truncated: boolean;
};

const page = z.coerce.number().int().min(1).default(1);

export const EmployeeUpdatesQuerySchema = checkRange(
  z.object({
    ...rangeShape,
    category: z.enum(UPDATE_CATEGORIES).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  }),
);
export type EmployeeUpdatesQuery = z.output<typeof EmployeeUpdatesQuerySchema>;
export type EmployeeUpdatesResponse = { items: WorkUpdateDto[]; page: number; pageSize: number; total: number };

export const CloseSessionSchema = z.object({ endedAt: z.string().datetime() });
export type CloseSessionInput = z.output<typeof CloseSessionSchema>;

export const WORK_SESSION_FILTERS = ['ACTIVE', 'COMPLETED', 'LEFT_RUNNING', 'CLOSED'] as const;
export const WorkSessionsQuerySchema = checkRange(
  z.object({
    ...rangeShape,
    status: z.enum(WORK_SESSION_FILTERS).optional(),
    query: z.string().trim().max(160).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }),
);
export type WorkSessionsQuery = z.output<typeof WorkSessionsQuerySchema>;
export type WorkSessionRow = AdminSessionDto & { employeeId: string; employeeName: string };
export type WorkSessionsResponse = { timezone: string; items: WorkSessionRow[]; page: number; pageSize: number; total: number };

/** One word for an admin: how this session ended (or didn't). */
export function sessionLabel(s: { status: SessionStatus; leftRunning: boolean }) {
  if (s.status === 'INCOMPLETE') return 'Closed by admin' as const;
  if (s.status === 'COMPLETED') return 'Completed' as const;
  return s.leftRunning ? ('Left running' as const) : ('Active' as const);
}
```
Append `export * from './ranges.js'; export * from './employee-activity.js';` to `index.ts`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build` → PASS. The Phase 4 history tests still pass.
- [ ] **Step 4: Commit.** `git commit -m "feat(types): shared date ranges and employee activity contracts"`

---

### Task 2: Gap and distance calculations (API, pure)

**Files:**
- Create: `apps/api/src/common/utils/geo.ts`, `apps/api/src/common/utils/trail.ts`, `apps/api/test/unit/trail.spec.ts`

**Interfaces:**
- Produces:
  - `haversineKm(a: {latitude; longitude}, b): number`
  - `GAP_MS = 15 * 60_000`
  - `MAX_PLAUSIBLE_KMH = 150`
  - `findGaps(sessions: Array<{ id; start: Date; end: Date }>, points: Array<{ sessionId; capturedAt: Date }>): TrailGap[]`. Each session's `end` is already clipped to the period and to now.
  - `distanceKm(points: Array<{ sessionId; capturedAt: Date; latitude; longitude; qualityFlag }>): number`. It uses only GOOD points within the same session and skips segments faster than 150 km/h. The result is rounded to 0.1 km.

- [ ] **Step 1: Write the failing test.** `apps/api/test/unit/trail.spec.ts`:
```ts
import { haversineKm } from '../../src/common/utils/geo.js';
import { distanceKm, findGaps } from '../../src/common/utils/trail.js';

const t = (hhmm: string) => new Date(`2026-10-06T${hhmm}:00Z`);
const p = (sessionId: string, hhmm: string, latitude = 19.07, longitude = 72.87, qualityFlag = 'GOOD') =>
  ({ sessionId, capturedAt: t(hhmm), latitude, longitude, qualityFlag });

describe('geo', () => {
  it('measures Mumbai CST to Bandra as roughly 12 km', () => {
    expect(haversineKm({ latitude: 18.94, longitude: 72.835 }, { latitude: 19.054, longitude: 72.84 })).toBeCloseTo(12.7, 0);
  });
});

describe('findGaps', () => {
  const session = { id: 's1', start: t('04:00'), end: t('06:00') };

  it('reports silences longer than 15 minutes, including at the edges', () => {
    const gaps = findGaps([session], [p('s1', '04:05'), p('s1', '04:10'), p('s1', '04:52'), p('s1', '05:40')]);
    expect(gaps.map((g) => [g.from.slice(11, 16), g.to.slice(11, 16), g.minutes])).toEqual([
      ['04:10', '04:52', 42],
      ['04:52', '05:40', 48],
      ['05:40', '06:00', 20],
    ]);
  });

  it('treats a session with no points as one gap', () => {
    expect(findGaps([session], [])).toEqual([{ sessionId: 's1', from: t('04:00').toISOString(), to: t('06:00').toISOString(), minutes: 120 }]);
  });

  it('ignores short silences and other sessions’ points', () => {
    const gaps = findGaps([{ id: 's1', start: t('04:00'), end: t('04:20') }], [p('s1', '04:05'), p('s1', '04:18'), p('s2', '04:10')]);
    expect(gaps).toEqual([]);
  });
});

describe('distanceKm', () => {
  it('adds up GOOD points within a session', () => {
    expect(distanceKm([p('s1', '04:00', 18.94, 72.835), p('s1', '04:30', 19.054, 72.84)])).toBeCloseTo(12.7, 0);
  });

  it('skips approximate points, session boundaries and impossible jumps', () => {
    const km = distanceKm([
      p('s1', '04:00', 19.0, 72.8),
      p('s1', '04:05', 19.5, 72.8, 'LOW_ACCURACY'),
      p('s1', '04:10', 19.001, 72.8),
      p('s1', '04:15', 21.0, 72.8), // ~220 km in 5 min: GPS glitch
      p('s2', '05:00', 19.2, 72.8),
    ]);
    expect(km).toBeCloseTo(0.1, 1);
  });
});
```
Run `cd apps/api && pnpm test:unit` → FAIL.

- [ ] **Step 2: Implement.** `src/common/utils/geo.ts`:
```ts
const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export type LatLng = { latitude: number; longitude: number };

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
```

`src/common/utils/trail.ts`:
```ts
import type { TrailGap } from '@worktrail/types';
import { haversineKm, type LatLng } from './geo.js';

/** A silence longer than three missed 5-minute targets counts as a gap. */
export const GAP_MS = 15 * 60_000;
/** Faster than this between two points is treated as a GPS glitch, not travel. */
export const MAX_PLAUSIBLE_KMH = 150;

type GapSession = { id: string; start: Date; end: Date };
type GapPoint = { sessionId: string; capturedAt: Date };
type DistPoint = GapPoint & LatLng & { qualityFlag: string };

export function findGaps(sessions: GapSession[], points: GapPoint[]): TrailGap[] {
  const gaps: TrailGap[] = [];
  for (const s of sessions) {
    const times = points
      .filter((p) => p.sessionId === s.id)
      .map((p) => p.capturedAt.getTime())
      .filter((ms) => ms >= s.start.getTime() && ms <= s.end.getTime())
      .sort((a, b) => a - b);
    const marks = [s.start.getTime(), ...times, s.end.getTime()];
    for (let i = 1; i < marks.length; i++) {
      const from = marks[i - 1]!;
      const to = marks[i]!;
      if (to - from > GAP_MS) {
        gaps.push({ sessionId: s.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), minutes: Math.round((to - from) / 60_000) });
      }
    }
  }
  return gaps;
}

export function distanceKm(points: DistPoint[]): number {
  const good = points
    .filter((p) => p.qualityFlag === 'GOOD')
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.capturedAt.getTime() - b.capturedAt.getTime());
  let km = 0;
  for (let i = 1; i < good.length; i++) {
    const a = good[i - 1]!;
    const b = good[i]!;
    if (a.sessionId !== b.sessionId) continue;
    const step = haversineKm(a, b);
    const hours = (b.capturedAt.getTime() - a.capturedAt.getTime()) / 3_600_000;
    if (hours > 0 && step / hours > MAX_PLAUSIBLE_KMH) continue;
    km += step;
  }
  return Math.round(km * 10) / 10;
}
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test:unit` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): trail gap and distance calculations"`

---

### Task 3: Employee detail, sessions, summary and updates endpoints (API)

**Files:**
- Create: `apps/api/src/modules/employee-activity/{employee-activity.module.ts, services/employee-access.service.ts, services/activity.service.ts, controllers/employee-activity.controller.ts}`, `apps/api/test/e2e/employee-activity.e2e-spec.ts`
- Modify: `apps/api/src/modules/employees/services/employees.service.ts` (`get` → `EmployeeDetail`), `apps/api/test/e2e/isolation.e2e-spec.ts`, `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: Task 1 types; `dayBounds`, `shiftDate`, `minutesWithin` (`common/utils/time.ts`); `distanceKm` (Task 2); `toUpdateDto` (Phase 4); `ZodQuery` (Phase 4).
- Produces:
  - `EmployeeAccessService.find(companyId, employeeId): Promise<Employee & { company: Company }>`, which gives 404 for a malformed id or another company's id
  - `periodBounds(range, tz) → { start: Date; end: Date; dates: string[] }`, exported from `activity.service.ts`
  - `isLeftRunning(s: { status; startedAtServer: Date }, now): boolean`
  - `toAdminSession(s, pointCount, lastLocationAt, now): AdminSessionDto`
  - `GET /employees/:employeeId/sessions` → `EmployeeSessionsResponse`
  - `GET /employees/:employeeId/summary` → `EmployeeSummary`
  - `GET /employees/:employeeId/updates` → `EmployeeUpdatesResponse`
  - `GET /employees/:id` → `EmployeeDetail`

- [ ] **Step 1: Write the failing e2e test.** `apps/api/test/e2e/employee-activity.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

describe('employee activity (admin)', () => {
  let app: INestApplication;
  const get = (token: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  async function seeded() {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid, { name: 'Amit Kumar', designation: 'Field Sales', phone: '+919800000110' });
    const d4 = dayBounds('2026-10-04', TZ);
    // 23:30–00:30 IST across 4→5 Oct, and a normal day on the 5th.
    const overnight = await prisma.workSession.create({ data: { companyId: cid, employeeId: emp.id, status: 'COMPLETED',
      startedAtServer: new Date(d4.end.getTime() - 30 * 60_000), endedAtServer: new Date(d4.end.getTime() + 30 * 60_000), totalMinutes: 60 } });
    const d5 = dayBounds('2026-10-05', TZ);
    const day = await prisma.workSession.create({ data: { companyId: cid, employeeId: emp.id, status: 'COMPLETED',
      startedAtServer: new Date(d5.start.getTime() + 3 * 3600_000), endedAtServer: new Date(d5.start.getTime() + 5 * 3600_000), totalMinutes: 120 } });
    await prisma.locationPoint.createMany({ data: [0, 30, 60].map((m) => ({
      companyId: cid, employeeId: emp.id, sessionId: day.id, clientPointId: randomUUID(),
      latitude: 19.0 + m / 1000, longitude: 72.8, source: 'BACKGROUND' as const, capturedAt: new Date(day.startedAtServer.getTime() + m * 60_000),
    })) });
    for (let i = 0; i < 3; i++) {
      await prisma.workUpdate.create({ data: { companyId: cid, employeeId: emp.id, sessionId: day.id, clientUpdateId: randomUUID(),
        text: `Update number ${i}`, inputMethod: i === 0 ? 'VOICE' : 'TYPED', category: i === 0 ? 'SITE_VISIT' : null,
        submittedAt: new Date(day.startedAtServer.getTime() + (i + 1) * 10 * 60_000) } });
    }
    return { admin, emp, overnight, day };
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

  it('detail includes phone, joined date and last seen', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}`).expect(200);
    expect(res.body).toMatchObject({ name: 'Amit Kumar', phone: '+919800000110', workingSince: null, lastSeenAt: expect.any(String), joinedAt: expect.any(String) });
  });

  it('sessions splits the overnight session across days and totals the period', async () => {
    const { admin, emp, overnight } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/sessions?from=2026-10-04&to=2026-10-05`).expect(200);
    expect(res.body.days).toEqual([{ date: '2026-10-04', minutes: 30 }, { date: '2026-10-05', minutes: 150 }]);
    expect(res.body.totalMinutes).toBe(180);
    const o = res.body.sessions.find((s: { id: string }) => s.id === overnight.id);
    expect(o).toMatchObject({ pointCount: 0, leftRunning: false });
  });

  it('summary counts hours, days, updates, points and distance', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/summary?from=2026-10-05&to=2026-10-05`).expect(200);
    expect(res.body).toMatchObject({ totalMinutes: 150, daysWorked: 1, updateCount: 3, pointCount: 3, leftRunning: false });
    expect(res.body.distanceKm).toBeGreaterThan(0);
  });

  it('updates are newest first, paged and filterable by category', async () => {
    const { admin, emp } = await seeded();
    const page1 = await get(admin.token, `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05&pageSize=2`).expect(200);
    expect(page1.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page1.body.items.map((u: { text: string }) => u.text)).toEqual(['Update number 2', 'Update number 1']);
    const voice = await get(admin.token, `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05&category=SITE_VISIT`).expect(200);
    expect(voice.body.items).toHaveLength(1);
  });

  it('flags a session left running for more than 14 hours', async () => {
    const { admin, emp } = await seeded();
    await prisma.workSession.create({ data: { companyId: admin.user.companyId, employeeId: emp.id, startedAtServer: new Date(Date.now() - 20 * 3600_000) } });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const res = await get(admin.token, `/employees/${emp.id}/summary?from=${yesterday}&to=${today}`).expect(200);
    expect(res.body.leftRunning).toBe(true);
  });

  it("every activity route returns 404 for another company's employee", async () => {
    const { emp } = await seeded();
    const other = await signupAs(app);
    for (const path of [`/employees/${emp.id}`, `/employees/${emp.id}/sessions?from=2026-10-05&to=2026-10-05`,
      `/employees/${emp.id}/summary?from=2026-10-05&to=2026-10-05`, `/employees/${emp.id}/updates?from=2026-10-05&to=2026-10-05`,
      `/employees/${emp.id}/location-trail?from=2026-10-05&to=2026-10-05`]) {
      const res = await get(other.token, path).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('refuses bad ranges with field messages', async () => {
    const { admin, emp } = await seeded();
    const res = await get(admin.token, `/employees/${emp.id}/sessions?from=2026-08-01&to=2026-10-06`).expect(400);
    expect(res.body.error.details.fields.from).toBe('Choose at most 31 days.');
  });
});
```
(The location-trail route in the 404 loop is implemented in Task 4. Until then that one path returns 404 because the route doesn't exist, which is the expected status anyway. Task 4 adds its own tests.)

In `isolation.e2e-spec.ts`, extend the detail assertion: `expect(res.body).toHaveProperty('joinedAt')` on an own-company employee. Run → FAIL.

- [ ] **Step 2: Implement.**

`services/employee-access.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Finds an employee inside the admin's company. Another company's id looks exactly like a missing one. */
@Injectable()
export class EmployeeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async find(companyId: string, employeeId: string) {
    const notFound = new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (!UUID.test(employeeId)) throw notFound;
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { company: true },
    });
    if (!employee) throw notFound;
    return employee;
  }
}
```

`services/activity.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { Prisma, WorkSession } from '@prisma/client';
import {
  type AdminSessionDto,
  type DateRange,
  type EmployeeSessionsResponse,
  type EmployeeSummary,
  type EmployeeUpdatesQuery,
  type EmployeeUpdatesResponse,
  LEFT_RUNNING_AFTER_MS,
} from '@worktrail/types';
import { dayBounds, minutesWithin, shiftDate } from '../../../common/utils/time.js';
import { distanceKm } from '../../../common/utils/trail.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toUpdateDto } from '../../updates/services/updates.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

export function periodBounds(range: DateRange, tz: string) {
  const dates: string[] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) dates.push(d);
  return { start: dayBounds(range.from, tz).start, end: dayBounds(range.to, tz).end, dates };
}

export const isLeftRunning = (s: Pick<WorkSession, 'status' | 'startedAtServer'>, now: Date) =>
  s.status === 'ACTIVE' && now.getTime() - s.startedAtServer.getTime() >= LEFT_RUNNING_AFTER_MS;

export function toAdminSession(s: WorkSession, pointCount: number, lastLocationAt: Date | null, now: Date): AdminSessionDto {
  return {
    id: s.id,
    status: s.status,
    startedAt: s.startedAtServer.toISOString(),
    endedAt: s.endedAtServer?.toISOString() ?? null,
    totalMinutes: s.totalMinutes,
    lastLocationAt: lastLocationAt?.toISOString() ?? null,
    pointCount,
    leftRunning: isLeftRunning(s, now),
  };
}

/** Sessions overlapping [start, end). */
export const overlapping = (start: Date, end: Date): Prisma.WorkSessionWhereInput => ({
  startedAtServer: { lt: end },
  OR: [{ endedAtServer: null }, { endedAtServer: { gt: start } }],
});

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  async sessions(companyId: string, employeeId: string, range: DateRange): Promise<EmployeeSessionsResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const tz = employee.company.timezone;
    const { start, end, dates } = periodBounds(range, tz);
    const now = new Date();
    const sessions = await this.prisma.workSession.findMany({
      where: { employeeId: employee.id, ...overlapping(start, end) },
      orderBy: { startedAtServer: 'desc' },
    });
    const stats = await this.prisma.locationPoint.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      _count: { _all: true },
      _max: { capturedAt: true },
    });
    const bySession = new Map(stats.map((s) => [s.sessionId, s]));
    const spans = sessions.map((s) => ({ start: s.startedAtServer, end: s.endedAtServer }));
    const days = dates.map((date) => {
      const b = dayBounds(date, tz);
      return { date, minutes: minutesWithin(spans, b.start, b.end, now) };
    });
    return {
      timezone: tz,
      sessions: sessions.map((s) =>
        toAdminSession(s, bySession.get(s.id)?._count._all ?? 0, bySession.get(s.id)?._max.capturedAt ?? null, now),
      ),
      days,
      totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
    };
  }

  async summary(companyId: string, employeeId: string, range: DateRange): Promise<EmployeeSummary> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(range, employee.company.timezone);
    const [sessions, updateCount, points, last] = await Promise.all([
      this.sessions(companyId, employeeId, range),
      this.prisma.workUpdate.count({ where: { employeeId: employee.id, submittedAt: { gte: start, lt: end } } }),
      this.prisma.locationPoint.findMany({
        where: { employeeId: employee.id, capturedAt: { gte: start, lt: end } },
        select: { sessionId: true, capturedAt: true, latitude: true, longitude: true, qualityFlag: true },
      }),
      this.prisma.locationPoint.findFirst({ where: { employeeId: employee.id }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
    ]);
    return {
      from: range.from,
      to: range.to,
      totalMinutes: sessions.totalMinutes,
      daysWorked: sessions.days.filter((d) => d.minutes > 0).length,
      updateCount,
      pointCount: points.length,
      distanceKm: distanceKm(points.map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))),
      lastSeenAt: last?.capturedAt.toISOString() ?? null,
      leftRunning: sessions.sessions.some((s) => s.leftRunning),
    };
  }

  async updates(companyId: string, employeeId: string, q: EmployeeUpdatesQuery): Promise<EmployeeUpdatesResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(q, employee.company.timezone);
    const where: Prisma.WorkUpdateWhereInput = {
      employeeId: employee.id,
      submittedAt: { gte: start, lt: end },
      ...(q.category ? { category: q.category } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.workUpdate.findMany({ where, orderBy: { submittedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.workUpdate.count({ where }),
    ]);
    return { items: rows.map(toUpdateDto), page: q.page, pageSize: q.pageSize, total };
  }
}
```

`controllers/employee-activity.controller.ts`:
```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type DateRange,
  DateRangeSchema,
  type EmployeeUpdatesQuery,
  EmployeeUpdatesQuerySchema,
} from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ActivityService } from '../services/activity.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('employees/:employeeId')
export class EmployeeActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.activity.sessions(auth.companyId, id, q);
  }

  @Get('summary')
  summary(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.activity.summary(auth.companyId, id, q);
  }

  @Get('updates')
  updates(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId') id: string,
    @Query(new ZodQuery(EmployeeUpdatesQuerySchema)) q: EmployeeUpdatesQuery,
  ) {
    return this.activity.updates(auth.companyId, id, q);
  }
}
```
Route order: Nest matches `GET employees/:id` (EmployeesController) separately from `GET employees/:employeeId/sessions`, because they have different segment counts. Add `test` assertions above to confirm.

`employee-activity.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { EmployeeActivityController } from './controllers/employee-activity.controller.js';
import { ActivityService } from './services/activity.service.js';
import { EmployeeAccessService } from './services/employee-access.service.js';

@Module({
  controllers: [EmployeeActivityController],
  providers: [EmployeeAccessService, ActivityService],
  exports: [EmployeeAccessService, ActivityService],
})
export class EmployeeActivityModule {}
```
Import it in `app.module.ts`.

`employees.service.ts` `get()`: extend `select` for the detail query with `phone: true, createdAt: true` and `sessions: { where: { status: 'ACTIVE' }, select: { id: true, startedAtServer: true }, take: 1 }`. Then:
```ts
  async get(companyId: string, id: string): Promise<EmployeeDetail> {
    // …existing UUID / not-found checks…
    const last = await this.prisma.locationPoint.findFirst({ where: { employeeId: row.id }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } });
    return {
      ...toItem(row),
      phone: row.phone,
      joinedAt: row.createdAt.toISOString(),
      workingSince: row.sessions[0]?.startedAtServer.toISOString() ?? null,
      lastSeenAt: last?.capturedAt.toISOString() ?? null,
    };
  }
```
Use a separate `detailSelect` constant (`{ ...select, phone: true, createdAt: true, sessions: { … startedAtServer … } }`) so `list()` stays light.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): employee detail, sessions per day, summary and updates for admins"`

---

### Task 4: Location trail endpoint (API)

**Files:**
- Create: `apps/api/src/modules/employee-activity/services/trail.service.ts`, `apps/api/test/e2e/employee-trail.e2e-spec.ts`
- Modify: `employee-activity.controller.ts` (add the route), `employee-activity.module.ts` (provider)

**Interfaces:**
- Consumes: `periodBounds`, `overlapping` (Task 3), `findGaps`, `distanceKm` (Task 2).
- Produces:
  - `TRAIL_POINT_LIMIT = 5000`
  - `GET /employees/:employeeId/location-trail?from&to` → `LocationTrailResponse`

    Points are in time order. Sessions are clipped to the period. Gaps are computed per session, clipped to the period and to now. `stats.lowAccuracyCount` counts `LOW_ACCURACY` and `SUSPICIOUS`.

- [ ] **Step 1: Write the failing test.** `apps/api/test/e2e/employee-trail.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { dayBounds } from '../../src/common/utils/time.js';
import { makeEmployee, resetDb } from '../helpers/db.js';
import { signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();

describe('GET /employees/:id/location-trail', () => {
  let app: INestApplication;
  const trail = (token: string, id: string, q = 'from=2026-10-05&to=2026-10-05') =>
    request(app.getHttpServer()).get(`/api/v1/employees/${id}/location-trail?${q}`).set('Authorization', `Bearer ${token}`);

  async function withPoints(minutes: number[], quality: Record<number, 'LOW_ACCURACY'> = {}) {
    const admin = await signupAs(app);
    const cid = admin.user.companyId;
    const emp = await makeEmployee(prisma, cid);
    const start = new Date(dayBounds('2026-10-05', 'Asia/Kolkata').start.getTime() + 3 * 3600_000);
    const s = await prisma.workSession.create({ data: { companyId: cid, employeeId: emp.id, status: 'COMPLETED', startedAtServer: start, endedAtServer: new Date(start.getTime() + 120 * 60_000) } });
    await prisma.locationPoint.createMany({ data: minutes.map((m, i) => ({
      companyId: cid, employeeId: emp.id, sessionId: s.id, clientPointId: randomUUID(),
      latitude: 19 + i * 0.001, longitude: 72.8, accuracyMeters: quality[m] ? 300 : 15, qualityFlag: quality[m] ?? 'GOOD',
      source: i === 0 ? ('START' as const) : ('BACKGROUND' as const), capturedAt: new Date(start.getTime() + m * 60_000),
    })) });
    return { admin, emp, s };
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

  it('returns ordered points, the session, gaps and stats', async () => {
    const { admin, emp, s } = await withPoints([0, 5, 10, 60, 65], { 65: 'LOW_ACCURACY' });
    const res = await trail(admin.token, emp.id).expect(200);
    expect(res.body.sessions).toEqual([expect.objectContaining({ id: s.id, status: 'COMPLETED' })]);
    expect(res.body.points.map((p: { source: string }) => p.source)).toEqual(['START', 'BACKGROUND', 'BACKGROUND', 'BACKGROUND', 'BACKGROUND']);
    expect(res.body.gaps.map((g: { minutes: number }) => g.minutes)).toEqual([50, 55]);
    expect(res.body.stats).toMatchObject({ pointCount: 5, lowAccuracyCount: 1, gapCount: 2 });
    expect(res.body.truncated).toBe(false);
  });

  it('an empty period returns no points and no crash', async () => {
    const { admin, emp } = await withPoints([0]);
    const res = await trail(admin.token, emp.id, 'from=2026-10-01&to=2026-10-01').expect(200);
    expect(res.body).toMatchObject({ points: [], sessions: [], gaps: [], stats: { pointCount: 0, distanceKm: 0 } });
  });

  it('caps very large trails and says so', async () => {
    const { admin, emp, s } = await withPoints([]);
    await prisma.locationPoint.createMany({ data: Array.from({ length: 5003 }, (_, i) => ({
      companyId: admin.user.companyId, employeeId: emp.id, sessionId: s.id, clientPointId: randomUUID(),
      latitude: 19, longitude: 72.8, source: 'BACKGROUND' as const, capturedAt: new Date(s.startedAtServer.getTime() + i * 1000),
    })) });
    const res = await trail(admin.token, emp.id).expect(200);
    expect(res.body.points).toHaveLength(5000);
    expect(res.body.truncated).toBe(true);
  });

  it('is admin-only and company-scoped', async () => {
    const { emp } = await withPoints([0]);
    const other = await signupAs(app);
    await trail(other.token, emp.id).expect(404);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `services/trail.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { DateRange, LocationTrailResponse, TrailPoint } from '@worktrail/types';
import { distanceKm, findGaps } from '../../../common/utils/trail.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { overlapping, periodBounds } from './activity.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

export const TRAIL_POINT_LIMIT = 5000;
const num = (v: { toNumber(): number } | null) => (v == null ? null : v.toNumber());

@Injectable()
export class TrailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  async trail(companyId: string, employeeId: string, range: DateRange): Promise<LocationTrailResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(range, employee.company.timezone);
    const now = new Date();

    const [sessions, rows] = await Promise.all([
      this.prisma.workSession.findMany({ where: { employeeId: employee.id, ...overlapping(start, end) }, orderBy: { startedAtServer: 'asc' } }),
      this.prisma.locationPoint.findMany({
        where: { employeeId: employee.id, capturedAt: { gte: start, lt: end } },
        orderBy: { capturedAt: 'asc' },
        take: TRAIL_POINT_LIMIT + 1,
      }),
    ]);
    const truncated = rows.length > TRAIL_POINT_LIMIT;
    const kept = rows.slice(0, TRAIL_POINT_LIMIT);

    const points: TrailPoint[] = kept.map((p) => ({
      id: p.id,
      sessionId: p.sessionId,
      latitude: p.latitude.toNumber(),
      longitude: p.longitude.toNumber(),
      accuracyMeters: num(p.accuracyMeters),
      speedMps: num(p.speedMps),
      capturedAt: p.capturedAt.toISOString(),
      source: p.source,
      qualityFlag: p.qualityFlag,
    }));
    const clip = (d: Date) => new Date(Math.min(Math.max(d.getTime(), start.getTime()), end.getTime(), now.getTime()));
    const gaps = findGaps(
      sessions.map((s) => ({ id: s.id, start: clip(s.startedAtServer), end: clip(s.endedAtServer ?? now) })),
      kept.map((p) => ({ sessionId: p.sessionId, capturedAt: p.capturedAt })),
    );

    return {
      timezone: employee.company.timezone,
      sessions: sessions.map((s) => ({ id: s.id, status: s.status, startedAt: s.startedAtServer.toISOString(), endedAt: s.endedAtServer?.toISOString() ?? null })),
      points,
      gaps,
      stats: {
        pointCount: points.length,
        lowAccuracyCount: points.filter((p) => p.qualityFlag === 'LOW_ACCURACY' || p.qualityFlag === 'SUSPICIOUS').length,
        gapCount: gaps.length,
        distanceKm: distanceKm(points.map((p) => ({ ...p, capturedAt: new Date(p.capturedAt) }))),
      },
      truncated,
    };
  }
}
```
In the controller, inject `TrailService` and add:
```ts
  @Get('location-trail')
  trail(@CurrentAuth() auth: AuthContext, @Param('employeeId') id: string, @Query(new ZodQuery(DateRangeSchema)) q: DateRange) {
    return this.trailService.trail(auth.companyId, id, q);
  }
```
Register `TrailService` in the module (providers and exports).

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test` → PASS. Task 3's 404 loop now hits the real route.
- [ ] **Step 4: Commit.** `git commit -m "feat(api): employee location trail with gaps, stats and point cap"`

---

### Task 5: Close a forgotten session and the company-wide session list (API)

**Files:**
- Create: `services/close-session.service.ts`, `services/work-sessions.service.ts`, `controllers/work-sessions.controller.ts`, `apps/api/test/e2e/work-sessions.e2e-spec.ts`
- Modify: `employee-activity.controller.ts` (close route), `employee-activity.module.ts`, `apps/api/src/common/audit/audit.service.ts`

**Interfaces:**
- Consumes: `EmployeeAccessService`, `toAdminSession`, `periodBounds`, `overlapping` (Task 3), `AuditService` (Phase 1b), `CloseSessionSchema`, `WorkSessionsQuerySchema` (Task 1).
- Produces:
  - `POST /employees/:employeeId/sessions/:sessionId/close` `{ endedAt }` → 200 `AdminSessionDto`. Errors:
    - 404 (wrong company, employee or session)
    - 409 `SESSION_NOT_ACTIVE`
    - 400 `INVALID_END_TIME`: "Choose an end time between the start of the session and now."
  - `GET /work-sessions?from&to&status&query&page&pageSize` → `WorkSessionsResponse`. It covers sessions overlapping the period, newest first. Status filter:
    - `ACTIVE`: active and not left running
    - `LEFT_RUNNING`: active for 14 h or more
    - `COMPLETED`
    - `CLOSED`: INCOMPLETE

- [ ] **Step 1: Write the failing test.** `apps/api/test/e2e/work-sessions.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/bootstrap.js';
import { resetDb } from '../helpers/db.js';
import { employeeAs, signupAs } from '../helpers/auth.js';

const prisma = new PrismaClient();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

describe('work sessions (admin)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function forgotten() {
    const admin = await signupAs(app);
    const e = await employeeAs(app, prisma, admin.user.companyId);
    const s = await prisma.workSession.create({ data: { companyId: admin.user.companyId, employeeId: e.employee.id, startedAtServer: hoursAgo(30) } });
    return { admin, e, s };
  }
  const close = (token: string, employeeId: string, sessionId: string, endedAt: string) =>
    http().post(`/api/v1/employees/${employeeId}/sessions/${sessionId}/close`).set('Authorization', `Bearer ${token}`).send({ endedAt });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('closes a forgotten session at the chosen time, marks it INCOMPLETE and audits it', async () => {
    const { admin, e, s } = await forgotten();
    const endedAt = hoursAgo(22).toISOString();
    const res = await close(admin.token, e.employee.id, s.id, endedAt).expect(200);
    expect(res.body).toMatchObject({ status: 'INCOMPLETE', endedAt, totalMinutes: 480, leftRunning: false });
    expect(await prisma.auditLog.count({ where: { action: 'session.closed_by_admin', entityId: s.id, actorUserId: admin.user.id } })).toBe(1);
    // The employee's phone learns on its next sync that nothing is running.
    const active = await http().get('/api/v1/sessions/me/active').set('Authorization', `Bearer ${e.token}`).expect(200);
    expect(active.body.session).toBeNull();
  });

  it('points captured after the admin’s end time are refused by the window check', async () => {
    const { admin, e, s } = await forgotten();
    await close(admin.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(200);
    const res = await http().post('/api/v1/locations/batch').set('Authorization', `Bearer ${e.token}`).set('Idempotency-Key', randomUUID())
      .send({ sessionId: s.id, points: [{ clientPointId: randomUUID(), latitude: 19, longitude: 72.8, capturedAt: hoursAgo(1).toISOString() }] }).expect(200);
    expect(res.body.rejected).toHaveLength(1);
  });

  it('refuses an end time before the start or in the future, and a second close', async () => {
    const { admin, e, s } = await forgotten();
    const bad = await close(admin.token, e.employee.id, s.id, hoursAgo(40).toISOString()).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'INVALID_END_TIME', message: 'Choose an end time between the start of the session and now.' });
    await close(admin.token, e.employee.id, s.id, new Date(Date.now() + 3600_000).toISOString()).expect(400);
    await close(admin.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(200);
    const again = await close(admin.token, e.employee.id, s.id, hoursAgo(21).toISOString()).expect(409);
    expect(again.body.error.code).toBe('SESSION_NOT_ACTIVE');
  });

  it("cannot close another company's session", async () => {
    const { e, s } = await forgotten();
    const other = await signupAs(app);
    await close(other.token, e.employee.id, s.id, hoursAgo(22).toISOString()).expect(404);
    expect((await prisma.workSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('ACTIVE');
  });

  it('lists company sessions with labels and filters', async () => {
    const { admin, e } = await forgotten();
    await prisma.workSession.create({ data: { companyId: admin.user.companyId, employeeId: e.employee.id, status: 'COMPLETED', startedAtServer: hoursAgo(5), endedAtServer: hoursAgo(1), totalMinutes: 240 } });
    const all = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toMatchObject({ employeeName: expect.any(String), status: 'COMPLETED', pointCount: 0 });
    const stuck = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}&status=LEFT_RUNNING`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(stuck.body.items).toEqual([expect.objectContaining({ leftRunning: true })]);
    const other = await signupAs(app);
    const none = await http().get(`/api/v1/work-sessions?from=${daysAgo(2)}&to=${today()}`).set('Authorization', `Bearer ${other.token}`).expect(200);
    expect(none.body.total).toBe(0);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** In `audit.service.ts`, add `| 'session.closed_by_admin'` to `AuditAction` and `| 'session'` to `entityType`.

`services/close-session.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { AdminSessionDto, CloseSessionInput } from '@worktrail/types';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { toAdminSession } from './activity.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An admin ends a session the employee forgot to end. Recorded as INCOMPLETE and audited. */
@Injectable()
export class CloseSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly audit: AuditService,
  ) {}

  async close(auth: AuthContext, employeeId: string, sessionId: string, input: CloseSessionInput): Promise<AdminSessionDto> {
    const employee = await this.access.find(auth.companyId, employeeId);
    const notFound = new AppError(404, 'NOT_FOUND', 'Work session not found.');
    if (!UUID.test(sessionId)) throw notFound;
    const session = await this.prisma.workSession.findFirst({ where: { id: sessionId, employeeId: employee.id } });
    if (!session) throw notFound;

    const now = new Date();
    const endedAt = new Date(input.endedAt);
    if (endedAt < session.startedAtServer || endedAt > now) {
      throw new AppError(400, 'INVALID_END_TIME', 'Choose an end time between the start of the session and now.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.workSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: {
          status: 'INCOMPLETE',
          endedAtServer: endedAt,
          totalMinutes: Math.round((endedAt.getTime() - session.startedAtServer.getTime()) / 60_000),
        },
      });
      if (claimed.count === 0) throw new AppError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.');
      await this.audit.record(
        {
          companyId: auth.companyId,
          actorUserId: auth.userId,
          action: 'session.closed_by_admin',
          entityType: 'session',
          entityId: session.id,
          metadata: { endedAt: endedAt.toISOString() },
        },
        tx,
      );
      return tx.workSession.findUniqueOrThrow({ where: { id: session.id } });
    });

    const stats = await this.prisma.locationPoint.aggregate({ where: { sessionId: session.id }, _count: { _all: true }, _max: { capturedAt: true } });
    return toAdminSession(updated, stats._count._all, stats._max.capturedAt, now);
  }
}
```

`services/work-sessions.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { LEFT_RUNNING_AFTER_MS, type WorkSessionsQuery, type WorkSessionsResponse } from '@worktrail/types';
import { PrismaService } from '../../../database/prisma.service.js';
import { overlapping, periodBounds, toAdminSession } from './activity.service.js';

@Injectable()
export class WorkSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, q: WorkSessionsQuery): Promise<WorkSessionsResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const { start, end } = periodBounds(q, company.timezone);
    const now = new Date();
    const stuckBefore = new Date(now.getTime() - LEFT_RUNNING_AFTER_MS);

    const where: Prisma.WorkSessionWhereInput = { companyId, ...overlapping(start, end) };
    if (q.query) where.employee = { name: { contains: q.query, mode: 'insensitive' } };
    if (q.status === 'ACTIVE') Object.assign(where, { status: 'ACTIVE', startedAtServer: { lt: end, gt: stuckBefore } });
    if (q.status === 'LEFT_RUNNING') Object.assign(where, { status: 'ACTIVE', startedAtServer: { lte: stuckBefore } });
    if (q.status === 'COMPLETED') where.status = 'COMPLETED';
    if (q.status === 'CLOSED') where.status = 'INCOMPLETE';

    const [rows, total] = await Promise.all([
      this.prisma.workSession.findMany({
        where,
        include: { employee: { select: { name: true } } },
        orderBy: { startedAtServer: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.workSession.count({ where }),
    ]);
    const stats = await this.prisma.locationPoint.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
      _max: { capturedAt: true },
    });
    const by = new Map(stats.map((s) => [s.sessionId, s]));
    return {
      timezone: company.timezone,
      items: rows.map((r) => ({
        ...toAdminSession(r, by.get(r.id)?._count._all ?? 0, by.get(r.id)?._max.capturedAt ?? null, now),
        employeeId: r.employeeId,
        employeeName: r.employee.name,
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }
}
```
For the `LEFT_RUNNING` filter, `Object.assign` replaces the `startedAtServer` condition from `overlapping`. That's intended, because a session left running overlaps any period after it started. The `OR` from `overlapping` still holds, since `endedAtServer` is null.

`controllers/work-sessions.controller.ts`:
```ts
import { Controller, Get, Query } from '@nestjs/common';
import { type WorkSessionsQuery, WorkSessionsQuerySchema } from '@worktrail/types';
import { ZodQuery } from '../../../common/pipes/zod-query.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { WorkSessionsService } from '../services/work-sessions.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('work-sessions')
export class WorkSessionsController {
  constructor(private readonly sessions: WorkSessionsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query(new ZodQuery(WorkSessionsQuerySchema)) q: WorkSessionsQuery) {
    return this.sessions.list(auth.companyId, q);
  }
}
```
In `employee-activity.controller.ts`, add (importing `Body`, `HttpCode`, `Post`, `CloseSessionSchema`, `type CloseSessionInput`, `ZodBody`):
```ts
  @Post('sessions/:sessionId/close')
  @HttpCode(200)
  close(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId') id: string,
    @Param('sessionId') sessionId: string,
    @Body(new ZodBody(CloseSessionSchema)) body: CloseSessionInput,
  ) {
    return this.closeSession.close(auth, id, sessionId, body);
  }
```
Module: add `WorkSessionsController` to controllers, and `CloseSessionService` and `WorkSessionsService` to providers.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/api test && pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint` → PASS.
- [ ] **Step 4: Update the seed.** In `prisma/seed.ts`, for the 5th employee (Vikram, `i === 4`):
  - add a session started 2 days ago at 09:00 IST and never ended (`status: 'ACTIVE'`);
  - remove the points between 13:00 and 13:40 IST from yesterday's route, which creates a gap.

  The unique index allows only one ACTIVE session per employee, and today's seeded session for i=4 is already completed (`active: i < 4`), so the left-running one is allowed. Run `pnpm --filter @worktrail/api db:seed`.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): admins close forgotten sessions (audited) and list all work sessions"`

---

### Task 6: Period picker and URL helpers (web)

**Files:**
- Create: `apps/web/src/lib/date-range.ts`, `apps/web/src/components/employee-detail/range-picker.tsx`, `apps/web/test/date-range.test.ts`

**Interfaces:**
- Produces:
  - `PRESETS = ['today','yesterday','this-week','last-week','this-month','custom'] as const`
  - `Preset`, `PRESET_LABELS`
  - `presetRange(preset, today: string): { from; to }`. Weeks start Monday. `this-month` runs from the 1st to today.
  - `parseRange(sp: Record<string, string|string[]|undefined>, today) → { preset; from; to; label; error: string|null }`. Invalid or over-31-day custom ranges fall back to `today` with an `error` message.
  - `rangeQuery(r): string` (`?range=this-week` or `?range=custom&from=…&to=…`)
  - `<RangePicker value={{ preset, from, to }} today />`, a client component that updates the URL with `router.replace` and keeps the path

- [ ] **Step 1: Write the failing test.** `apps/web/test/date-range.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseRange, presetRange, rangeQuery } from '@/lib/date-range';

describe('date ranges', () => {
  // 2026-10-07 is a Wednesday.
  it.each([
    ['today', '2026-10-07', '2026-10-07'],
    ['yesterday', '2026-10-06', '2026-10-06'],
    ['this-week', '2026-10-05', '2026-10-07'],
    ['last-week', '2026-09-28', '2026-10-04'],
    ['this-month', '2026-10-01', '2026-10-07'],
  ] as const)('%s', (preset, from, to) => {
    expect(presetRange(preset, '2026-10-07')).toEqual({ from, to });
  });

  it('this week on a Monday is just that Monday', () => {
    expect(presetRange('this-week', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('this week on a Sunday goes back to Monday', () => {
    expect(presetRange('this-week', '2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('parses a custom range and builds its query', () => {
    const r = parseRange({ range: 'custom', from: '2026-09-20', to: '2026-10-01' }, '2026-10-07');
    expect(r).toMatchObject({ preset: 'custom', from: '2026-09-20', to: '2026-10-01', error: null });
    expect(rangeQuery(r)).toBe('?range=custom&from=2026-09-20&to=2026-10-01');
    expect(r.label).toBe('20 Sep – 1 Oct 2026');
  });

  it('falls back to today with a message for a range over 31 days', () => {
    const r = parseRange({ range: 'custom', from: '2026-08-01', to: '2026-10-07' }, '2026-10-07');
    expect(r).toMatchObject({ preset: 'today', from: '2026-10-07', error: 'Choose at most 31 days.' });
  });

  it('defaults to today', () => {
    expect(parseRange({}, '2026-10-07')).toMatchObject({ preset: 'today', label: 'Today' });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `src/lib/date-range.ts`:
```ts
import { DateRangeSchema } from '@worktrail/types';

export const PRESETS = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'custom'] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  custom: 'Custom',
};

type Range = { from: string; to: string };
export type ParsedRange = Range & { preset: Preset; label: string; error: string | null };
type SearchParams = Record<string, string | string[] | undefined>;

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** 0 = Monday … 6 = Sunday. */
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const fmt = (date: string, withYear: boolean) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

export function presetRange(preset: Exclude<Preset, 'custom'>, today: string): Range {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = shift(today, -1);
      return { from: y, to: y };
    }
    case 'this-week':
      return { from: shift(today, -weekday(today)), to: today };
    case 'last-week': {
      const monday = shift(today, -weekday(today) - 7);
      return { from: monday, to: shift(monday, 6) };
    }
    case 'this-month':
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

export function parseRange(sp: SearchParams, today: string): ParsedRange {
  const preset = (PRESETS as readonly string[]).includes(first(sp.range) ?? '') ? (first(sp.range) as Preset) : 'today';
  if (preset !== 'custom') return { preset, ...presetRange(preset, today), label: PRESET_LABELS[preset], error: null };

  const parsed = DateRangeSchema.safeParse({ from: first(sp.from), to: first(sp.to) });
  if (!parsed.success) {
    return { preset: 'today', ...presetRange('today', today), label: 'Today', error: parsed.error.issues[0]?.message ?? 'Choose a valid period.' };
  }
  const { from, to } = parsed.data;
  return { preset, from, to, label: `${fmt(from, false)} – ${fmt(to, true)}`, error: null };
}

export const rangeQuery = (r: Pick<ParsedRange, 'preset' | 'from' | 'to'>) =>
  r.preset === 'custom' ? `?range=custom&from=${r.from}&to=${r.to}` : `?range=${r.preset}`;
```

`src/components/employee-detail/range-picker.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { PRESET_LABELS, PRESETS, type Preset, rangeQuery } from '@/lib/date-range';

type Props = { value: { preset: Preset; from: string; to: string }; today: string; error?: string | null };

export function RangePicker({ value, today, error }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const go = (preset: Preset, f = from, t = to) => router.replace(`${path}${rangeQuery({ preset, from: f, to: t })}`);

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-1 rounded-input border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value.preset === p}
            onClick={() => (p === 'custom' ? go('custom') : go(p))}
            className={cn('rounded-[9px] px-3 py-1.5 text-sm font-semibold', value.preset === p ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900')}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {value.preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">From <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="rounded-input border border-line px-2 py-1" /></label>
          <label className="flex items-center gap-2">To <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="rounded-input border border-line px-2 py-1" /></label>
          <button type="button" onClick={() => go('custom', from, to)} className="rounded-input bg-cta px-3 py-1.5 font-semibold text-white">Show</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/web test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(web): period presets and picker"`

---

### Task 7: Employee page shell, Overview, Updates and Work hours tabs (web)

**Files:**
- Create: `apps/web/src/app/app/employees/[id]/{layout.tsx,page.tsx,updates/page.tsx,hours/page.tsx,actions.ts,loading.tsx}`, `apps/web/src/components/employee-detail/{employee-header,tab-nav,overview-cards,updates-list,hours-table,close-session-dialog}.tsx`, `apps/web/test/employee-detail.test.tsx`
- Modify: `apps/web/src/components/employees/employee-table.tsx`, `apps/web/src/components/dashboard/{locations-card,recent-updates,work-hours}.tsx`, `apps/web/test/employees.test.tsx`, `apps/web/test/dashboard.test.tsx`

**Interfaces:**
- Consumes: Task 1 types; `parseRange`, `rangeQuery`, `RangePicker` (Task 6); `serverApi`, `serverMutate`, `MutationResult` (Phase 1b); `formatMinutes`, `timeIn`, `initials` (Phase 0–1 `lib/format.ts`); `StatusChip` (Phase 1b); `Card`, `Button`, `FormAlert`.
- Produces:
  - Routes `/app/employees/[id]`, `/app/employees/[id]/updates` and `/app/employees/[id]/hours`
  - `<TabNav id />`, which keeps the period query when switching tabs
  - `<HoursTable data timezone onClose? />`
  - `<UpdatesList items timezone />`
  - `<OverviewCards summary />`
  - `<CloseSessionDialog sessionId employeeId defaultEnd action />`
  - The `closeSession(employeeId, sessionId, endedAt)` Server Action

- [ ] **Step 1: Write the failing tests.** `apps/web/test/employee-detail.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeeSessionsResponse, EmployeeSummary, WorkUpdateDto } from '@worktrail/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/employees/e1/hours',
  useSearchParams: () => new URLSearchParams('range=this-week'),
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

import { TabNav } from '@/components/employee-detail/tab-nav';
import { OverviewCards } from '@/components/employee-detail/overview-cards';
import { HoursTable } from '@/components/employee-detail/hours-table';
import { UpdatesList } from '@/components/employee-detail/updates-list';
import { CloseSessionDialog } from '@/components/employee-detail/close-session-dialog';

const TZ = 'Asia/Kolkata';

describe('employee detail', () => {
  it('tabs keep the chosen period and mark the current tab', () => {
    render(<TabNav id="e1" />);
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/app/employees/e1/map?range=this-week');
    expect(screen.getByRole('link', { name: 'Work hours' })).toHaveAttribute('aria-current', 'page');
  });

  it('overview cards show hours, days, updates and distance', () => {
    const summary: EmployeeSummary = { from: '2026-10-05', to: '2026-10-07', totalMinutes: 1290, daysWorked: 3, updateCount: 7, pointCount: 240, distanceKm: 18.4, lastSeenAt: null, leftRunning: true };
    render(<OverviewCards summary={summary} />);
    expect(within(screen.getByRole('group', { name: 'Hours worked' })).getByText('21h 30m')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Distance covered' })).getByText('18.4 km')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A work session was left running');
  });

  it('hours table shows each day, the sessions and a total, and offers to close a forgotten session', async () => {
    const onClose = vi.fn();
    const data: EmployeeSessionsResponse = {
      timezone: TZ,
      days: [{ date: '2026-10-05', minutes: 548 }, { date: '2026-10-06', minutes: 0 }],
      totalMinutes: 548,
      sessions: [
        { id: 's1', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null, pointCount: 110, leftRunning: false },
        { id: 's2', status: 'ACTIVE', startedAt: '2026-10-04T03:30:00.000Z', endedAt: null, totalMinutes: null, lastLocationAt: '2026-10-04T12:00:00.000Z', pointCount: 90, leftRunning: true },
      ],
    };
    render(<HoursTable data={data} onClose={onClose} />);
    const mon = screen.getByRole('row', { name: /Mon 5 Oct/ });
    expect(within(mon).getByText('9:02 AM – 6:10 PM')).toBeInTheDocument();
    expect(within(mon).getByText('9h 8m')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('9h 8m');
    expect(screen.getByText('Left running')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close session' }));
    expect(onClose).toHaveBeenCalledWith(data.sessions[1]);
  });

  it('updates list shows category, voice and full text', () => {
    const items: WorkUpdateDto[] = [{ id: 'u1', clientUpdateId: 'c1', sessionId: 's1', text: 'Completed installation. One sensor needs replacement.', inputMethod: 'VOICE', category: 'INSTALLATION', submittedAt: '2026-10-05T05:30:00.000Z', summaryStatus: 'QUEUED' }];
    render(<UpdatesList items={items} timezone={TZ} />);
    expect(screen.getByText('Installation')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
    expect(screen.getByText('Mon 5 Oct · 11:00 AM')).toBeInTheDocument();
  });

  it('updates list invites a wider period when empty', () => {
    render(<UpdatesList items={[]} timezone={TZ} />);
    expect(screen.getByText('No updates in this period. Try a longer period, such as This week.')).toBeInTheDocument();
  });

  it('close dialog defaults to the last location time and shows server errors', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: 'Choose an end time between the start of the session and now.', fields: {} });
    render(<CloseSessionDialog employeeId="e1" session={{ id: 's2', startedAt: '2026-10-04T03:30:00.000Z', lastLocationAt: '2026-10-04T12:00:00.000Z' }} timezone={TZ} action={action} onDone={vi.fn()} />);
    expect(screen.getByLabelText('End time')).toHaveValue('2026-10-04T17:30');
    await userEvent.click(screen.getByRole('button', { name: 'Close session' }));
    expect(action).toHaveBeenCalledWith('e1', 's2', '2026-10-04T12:00:00.000Z');
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose an end time between the start of the session and now.');
  });
});
```
In `employees.test.tsx`, assert `screen.getByRole('link', { name: 'Amit Kumar' })` has `href="/app/employees/1"`. In `dashboard.test.tsx`, assert the work-hours and recent-update names are links to `/app/employees/{employeeId}`. Run → FAIL.

- [ ] **Step 2: Implement the components.**

`tab-nav.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: '/map', label: 'Map' },
  { slug: '/updates', label: 'Updates' },
  { slug: '/hours', label: 'Work hours' },
];

export function TabNav({ id }: { id: string }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  const base = `/app/employees/${id}`;
  return (
    <nav aria-label="Employee sections" className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const href = `${base}${t.slug}`;
        const active = path === href;
        return (
          <Link
            key={t.label}
            href={qs ? `${href}?${qs}` : href}
            aria-current={active ? 'page' : undefined}
            className={cn('-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold', active ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-900')}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`overview-cards.tsx`:
```tsx
import { Clock, CalendarDays, FileText, Route } from 'lucide-react';
import type { EmployeeSummary } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { formatMinutes } from '@/lib/format';

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <Card role="group" aria-label={label} className="p-5">
      <span className="grid size-10 place-items-center rounded-[10px] bg-brand-50 text-brand-500"><Icon className="size-5" aria-hidden /></span>
      <p className="mt-4 font-display text-[28px] font-bold leading-none text-ink-900">{value}</p>
      <p className="mt-1 text-sm text-ink-500">{label}</p>
    </Card>
  );
}

export function OverviewCards({ summary }: { summary: EmployeeSummary }) {
  return (
    <div className="space-y-4">
      {summary.leftRunning ? (
        <p role="alert" className="rounded-input border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-900">
          A work session was left running. Open Work hours to close it at the right time.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Hours worked" value={formatMinutes(summary.totalMinutes)} icon={Clock} />
        <Stat label="Days worked" value={String(summary.daysWorked)} icon={CalendarDays} />
        <Stat label="Updates" value={String(summary.updateCount)} icon={FileText} />
        <Stat label="Distance covered" value={`${summary.distanceKm} km`} icon={Route} />
      </div>
    </div>
  );
}
```

`updates-list.tsx`:
```tsx
import { formatInTimeZone } from 'date-fns-tz';
import { UPDATE_CATEGORY_LABELS, type WorkUpdateDto } from '@worktrail/types';

export function UpdatesList({ items, timezone }: { items: WorkUpdateDto[]; timezone: string }) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-ink-500">No updates in this period. Try a longer period, such as This week.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((u) => (
        <li key={u.id} className="px-5 py-4">
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
            {formatInTimeZone(new Date(u.submittedAt), timezone, 'EEE d MMM · h:mm a')}
            {u.category ? <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{UPDATE_CATEGORY_LABELS[u.category]}</span> : null}
            {u.inputMethod === 'VOICE' ? <span className="rounded-full bg-canvas px-2 py-0.5">Voice</span> : null}
          </p>
          <p className="mt-1.5 max-w-[75ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-900">{u.text}</p>
        </li>
      ))}
    </ul>
  );
}
```

`hours-table.tsx`:
```tsx
'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { type AdminSessionDto, type EmployeeSessionsResponse, sessionLabel } from '@worktrail/types';
import { formatMinutes } from '@/lib/format';

type Props = { data: EmployeeSessionsResponse; onClose?: (s: AdminSessionDto) => void };

export function HoursTable({ data, onClose }: Props) {
  const tz = data.timezone;
  const day = (iso: string) => formatInTimeZone(new Date(iso), tz, 'yyyy-MM-dd');
  const time = (iso: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');
  const label = (date: string) => formatInTimeZone(new Date(`${date}T12:00:00Z`), 'UTC', 'EEE d MMM');
  const stuck = data.sessions.filter((s) => s.leftRunning);

  return (
    <div className="space-y-4">
      {stuck.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold text-brand-700">Left running</span> · started {formatInTimeZone(new Date(s.startedAt), tz, 'EEE d MMM, h:mm a')}
            {s.lastLocationAt ? ` · last location ${formatInTimeZone(new Date(s.lastLocationAt), tz, 'EEE d MMM, h:mm a')}` : ''}
          </span>
          {onClose ? <button type="button" onClick={() => onClose(s)} className="rounded-input bg-cta px-3 py-1.5 font-semibold text-white">Close session</button> : null}
        </div>
      ))}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-ink-500">
          <tr><th scope="col" className="px-5 py-3 font-medium">Day</th><th scope="col" className="px-5 py-3 font-medium">Sessions</th><th scope="col" className="px-5 py-3 text-right font-medium">Hours</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.days.map((d) => {
            const sessions = data.sessions.filter((s) => day(s.startedAt) === d.date);
            return (
              <tr key={d.date}>
                <th scope="row" className="px-5 py-3 font-medium text-ink-900">{label(d.date)}</th>
                <td className="px-5 py-3 text-ink-700">
                  {sessions.length === 0 ? <span className="text-ink-300">—</span> : sessions.map((s) => (
                    <span key={s.id} className="mr-3 inline-flex items-center gap-2">
                      {time(s.startedAt)} – {s.endedAt ? time(s.endedAt) : 'now'}
                      {s.status !== 'COMPLETED' ? <span className="rounded-full bg-canvas px-2 py-0.5 text-xs">{sessionLabel(s)}</span> : null}
                    </span>
                  ))}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-900">{d.minutes ? formatMinutes(d.minutes) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line font-semibold text-ink-900"><th scope="row" className="px-5 py-3">Total</th><td /><td className="px-5 py-3 text-right tabular-nums">{formatMinutes(data.totalMinutes)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
```
The table's sessions column lists a session under the day it **started**. Minutes per day come from the API, so an overnight session's minutes still split correctly.

`close-session-dialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { AdminSessionDto } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  employeeId: string;
  session: Pick<AdminSessionDto, 'id' | 'startedAt' | 'lastLocationAt'>;
  timezone: string;
  action: (employeeId: string, sessionId: string, endedAt: string) => Promise<MutationResult<AdminSessionDto>>;
  onDone: () => void;
};

const LOCAL = "yyyy-MM-dd'T'HH:mm";

/** Ends a forgotten session. Defaults to the last moment we had a location for them. */
export function CloseSessionDialog({ employeeId, session, timezone, action, onDone }: Props) {
  const initial = session.lastLocationAt ?? session.startedAt;
  const [value, setValue] = useState(formatInTimeZone(new Date(initial), timezone, LOCAL));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const endedAt = value === formatInTimeZone(new Date(initial), timezone, LOCAL) ? initial : fromZonedTime(value, timezone).toISOString();
    const r = await action(employeeId, session.id, endedAt);
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.message);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="close-title" className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-panel bg-surface p-6 shadow-card">
        <h2 id="close-title" className="text-xl">Close this work session</h2>
        <p className="text-sm text-ink-700">
          Choose when the employee actually stopped working. The session will be marked “Closed by admin”, and this is recorded in the audit log.
        </p>
        <label htmlFor="close-end" className="block text-sm font-medium text-ink-900">End time</label>
        <input id="close-end" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 w-full rounded-input border border-line px-3" />
        <FormAlert message={error} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button loading={busy} onClick={() => void submit()}>Close session</Button>
        </div>
      </div>
    </div>
  );
}
```

`employee-header.tsx`:
```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { EmployeeDetail } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';
import { StatusChip } from '@/components/employees/status-chip';
import { timeIn } from '@/lib/format';

export function EmployeeHeader({ employee, timezone }: { employee: EmployeeDetail; timezone: string }) {
  const presence = employee.workingSince
    ? `Working since ${timeIn(employee.workingSince, timezone)}`
    : employee.lastSeenAt
      ? `Off duty · last seen ${timeIn(employee.lastSeenAt, timezone)}`
      : null;
  return (
    <div className="space-y-4">
      <Link href="/app/employees" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Employees
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={employee.name} size={56} />
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight">{employee.name}</h1>
          <p className="text-ink-500">{[employee.designation, employee.employeeCode, employee.email, employee.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <StatusChip employee={employee} />
          {presence ? <span className="text-sm text-ink-500">{presence}</span> : null}
        </div>
      </div>
    </div>
  );
}
```
The header joins meta fields with a middle dot, the same convention as the dashboard's map list.

- [ ] **Step 3: Implement the routes.**

`app/app/employees/[id]/layout.tsx`:
```tsx
import type { EmployeeDetail, MeResponse } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { Suspense } from 'react';
import { EmployeeHeader } from '@/components/employee-detail/employee-header';
import { TabNav } from '@/components/employee-detail/tab-nav';
import { serverApi } from '@/lib/server-api';

export default async function EmployeeLayout({ children, params }: LayoutProps<'/app/employees/[id]'>) {
  const { id } = await params;
  const [employee, me] = await Promise.all([serverApi<EmployeeDetail>(`/employees/${id}`), serverApi<MeResponse>('/me')]);
  const tz = me.company.timezone;
  return (
    <div className="mx-auto max-w-[1280px] space-y-6" data-today={formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')}>
      <EmployeeHeader employee={employee} timezone={tz} />
      <Suspense>
        <TabNav id={id} />
      </Suspense>
      {children}
    </div>
  );
}
```
A 404 from `/employees/:id` throws `ApiError(404)` in `serverApi`. Add a `not-found` mapping: in `serverApi`, when `res.status === 404`, call `notFound()` from `next/navigation`. That's a one-line change in `src/lib/server-api.ts`, listed in the changed files for this task. Next.js then renders its 404 page.

Each tab page reads the period itself (layouts don't receive `searchParams`). Shared helper in `src/lib/date-range.ts`:
```ts
export async function pageRange(searchParams: Promise<SearchParams>, timezone: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // YYYY-MM-DD
  return { range: parseRange(await searchParams, today), today };
}
```

`app/app/employees/[id]/page.tsx` (Overview):
```tsx
import type { EmployeeSummary, EmployeeUpdatesResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { OverviewCards } from '@/components/employee-detail/overview-cards';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { UpdatesList } from '@/components/employee-detail/updates-list';
import { pageRange } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

export default async function EmployeeOverview({ params, searchParams }: PageProps<'/app/employees/[id]'>) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const q = `from=${range.from}&to=${range.to}`;
  const [summary, latest] = await Promise.all([
    serverApi<EmployeeSummary>(`/employees/${id}/summary?${q}`),
    serverApi<EmployeeUpdatesResponse>(`/employees/${id}/updates?${q}&pageSize=5`),
  ]);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <OverviewCards summary={summary} />
      <Card>
        <h2 className="px-5 pt-5 text-lg">Latest updates</h2>
        <UpdatesList items={latest.items} timezone={me.company.timezone} />
      </Card>
    </div>
  );
}
```

`updates/page.tsx`: same pattern. Read `category` and `page` from `searchParams`, call `/employees/${id}/updates?${q}&page=${page}${category ? `&category=${category}` : ''}`, and render:
- a category filter row (links that preserve the range);
- `<UpdatesList>`;
- Previous/Next links. Reuse the Phase 1b `Pagination` component by passing `employeesHref`-style hrefs, or a small inline nav with "Showing 1–50 of 120".

`hours/page.tsx`:
```tsx
import type { EmployeeSessionsResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { HoursPanel } from '@/components/employee-detail/hours-panel';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { pageRange } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';
import { closeSession } from '../actions';

export default async function EmployeeHours({ params, searchParams }: PageProps<'/app/employees/[id]/hours'>) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const data = await serverApi<EmployeeSessionsResponse>(`/employees/${id}/sessions?from=${range.from}&to=${range.to}`);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="overflow-hidden p-0 pt-2">
        <HoursPanel employeeId={id} data={data} action={closeSession} />
      </Card>
    </div>
  );
}
```
Add `components/employee-detail/hours-panel.tsx`, a client component that holds which session is being closed:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminSessionDto, EmployeeSessionsResponse } from '@worktrail/types';
import type { MutationResult } from '@/lib/mutation-result';
import { CloseSessionDialog } from './close-session-dialog';
import { HoursTable } from './hours-table';

type Props = {
  employeeId: string;
  data: EmployeeSessionsResponse;
  action: (employeeId: string, sessionId: string, endedAt: string) => Promise<MutationResult<AdminSessionDto>>;
};

export function HoursPanel({ employeeId, data, action }: Props) {
  const router = useRouter();
  const [closing, setClosing] = useState<AdminSessionDto | null>(null);
  return (
    <>
      <HoursTable data={data} onClose={setClosing} />
      {closing ? (
        <CloseSessionDialog
          employeeId={employeeId}
          session={closing}
          timezone={data.timezone}
          action={action}
          onDone={() => {
            setClosing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
```

`app/app/employees/[id]/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { AdminSessionDto } from '@worktrail/types';
import { serverMutate } from '@/lib/server-api';

export async function closeSession(employeeId: string, sessionId: string, endedAt: string) {
  const result = await serverMutate<AdminSessionDto>(
    `/employees/${encodeURIComponent(employeeId)}/sessions/${encodeURIComponent(sessionId)}/close`,
    { endedAt },
  );
  if (result.ok) revalidatePath(`/app/employees/${employeeId}`, 'layout');
  return result;
}
```

`loading.tsx`: three pulsing card blocks (same style as `app/app/dashboard/loading.tsx`).

- [ ] **Step 4: Link names to the employee page.**
  - `employee-table.tsx`: wrap the name in `<Link href={`/app/employees/${e.id}`} className="font-semibold text-ink-900 hover:text-brand-700">`.
  - `locations-card.tsx`, `recent-updates.tsx`, `work-hours.tsx`: same, using `employeeId`.

- [ ] **Step 5: Run the tests and confirm they pass.** `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint` → PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(web): employee page with overview, updates, work hours and close-session"`

---

### Task 8: Map tab (web)

**Files:**
- Create: `apps/web/src/lib/trail-geojson.ts`, `apps/web/src/components/employee-detail/trail-map.tsx`, `apps/web/src/components/employee-detail/trail-summary.tsx`, `apps/web/src/app/app/employees/[id]/map/page.tsx`, `apps/web/test/trail-geojson.test.ts`
- Modify: `apps/web/test/employee-detail.test.tsx` (trail summary cases)

**Interfaces:**
- Consumes: `LocationTrailResponse` (Task 1), `setWorkerUrl` setup and Carto style (Phase 0–1 `locations-map.tsx`).
- Produces:
  - `trailToGeoJson(trail) → { routes: FeatureCollection<LineString>; gaps: FeatureCollection<LineString>; points: FeatureCollection<Point>; markers: Array<{ kind: 'start'|'end'; sessionId; latitude; longitude; time }>; bounds: [[minLng,minLat],[maxLng,maxLat]] | null }`
  - `<TrailSummary trail timezone />`
  - `<TrailMap trail timezone />`

- [ ] **Step 1: Write the failing tests.** `apps/web/test/trail-geojson.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { LocationTrailResponse } from '@worktrail/types';
import { trailToGeoJson } from '@/lib/trail-geojson';

const point = (id: string, sessionId: string, min: number, lat: number, quality: 'GOOD' | 'LOW_ACCURACY' = 'GOOD') => ({
  id, sessionId, latitude: lat, longitude: 72.8, accuracyMeters: quality === 'GOOD' ? 15 : 300, speedMps: null,
  capturedAt: new Date(Date.UTC(2026, 9, 5, 4, min)).toISOString(), source: 'BACKGROUND' as const, qualityFlag: quality,
});
const trail = (points: ReturnType<typeof point>[], gaps: LocationTrailResponse['gaps'] = []): LocationTrailResponse => ({
  timezone: 'Asia/Kolkata', sessions: [{ id: 's1', status: 'COMPLETED', startedAt: '', endedAt: '' }], points, gaps,
  stats: { pointCount: points.length, lowAccuracyCount: 0, gapCount: gaps.length, distanceKm: 0 }, truncated: false,
});

describe('trailToGeoJson', () => {
  it('draws one route line per session from GOOD points, and start/end markers', () => {
    const g = trailToGeoJson(trail([point('a', 's1', 0, 19.0), point('b', 's1', 5, 19.01, 'LOW_ACCURACY'), point('c', 's1', 10, 19.02)]));
    expect(g.routes.features).toHaveLength(1);
    expect(g.routes.features[0]!.geometry.coordinates).toEqual([[72.8, 19.0], [72.8, 19.02]]);
    expect(g.markers.map((m) => [m.kind, m.latitude])).toEqual([['start', 19.0], ['end', 19.02]]);
    expect(g.points.features.map((f) => f.properties.approximate)).toEqual([false, true, false]);
  });

  it('draws gaps as dashed segments between the points around them', () => {
    const g = trailToGeoJson(trail([point('a', 's1', 0, 19.0), point('b', 's1', 50, 19.05)], [
      { sessionId: 's1', from: new Date(Date.UTC(2026, 9, 5, 4, 0)).toISOString(), to: new Date(Date.UTC(2026, 9, 5, 4, 50)).toISOString(), minutes: 50 },
    ]));
    expect(g.gaps.features[0]!.geometry.coordinates).toEqual([[72.8, 19.0], [72.8, 19.05]]);
  });

  it('handles no points and a single point without crashing', () => {
    expect(trailToGeoJson(trail([])).bounds).toBeNull();
    const one = trailToGeoJson(trail([point('a', 's1', 0, 19.0)]));
    expect(one.routes.features).toHaveLength(0);
    expect(one.markers).toHaveLength(1);
    expect(one.bounds).toEqual([[72.8, 19.0], [72.8, 19.0]]);
  });
});
```
Add to `employee-detail.test.tsx`:
```tsx
import { TrailSummary } from '@/components/employee-detail/trail-summary';

  it('trail summary counts locations, distance and gaps, and warns about accuracy and truncation', () => {
    const t = { timezone: TZ, sessions: [], points: [], truncated: true,
      gaps: [{ sessionId: 's1', from: '2026-10-05T07:40:00.000Z', to: '2026-10-05T08:22:00.000Z', minutes: 42 }],
      stats: { pointCount: 28, lowAccuracyCount: 9, gapCount: 1, distanceKm: 3.4 } };
    render(<TrailSummary trail={t as never} />);
    expect(screen.getByText('28 locations · 3.4 km · 1 gap')).toBeInTheDocument();
    expect(screen.getByText('Some locations are approximate (accuracy worse than 100 m).')).toBeInTheDocument();
    expect(screen.getByText('Showing the first 5,000 locations. Choose a shorter period to see all of them.')).toBeInTheDocument();
    expect(screen.getByText('No location for 42 min · 1:10 PM – 1:52 PM')).toBeInTheDocument();
  });

  it('trail summary explains an empty period', () => {
    render(<TrailSummary trail={{ timezone: TZ, sessions: [], points: [], gaps: [], truncated: false, stats: { pointCount: 0, lowAccuracyCount: 0, gapCount: 0, distanceKm: 0 } }} />);
    expect(screen.getByText('No locations recorded in this period.')).toBeInTheDocument();
  });
```
Run → FAIL.

- [ ] **Step 2: Implement.** `src/lib/trail-geojson.ts`:
```ts
import type { LocationTrailResponse, TrailPoint } from '@worktrail/types';

type Line = { type: 'Feature'; properties: { sessionId: string }; geometry: { type: 'LineString'; coordinates: number[][] } };
type Dot = {
  type: 'Feature';
  properties: { id: string; approximate: boolean; capturedAt: string; accuracyMeters: number | null; speedMps: number | null; source: string };
  geometry: { type: 'Point'; coordinates: number[] };
};
export type Marker = { kind: 'start' | 'end'; sessionId: string; latitude: number; longitude: number; time: string };

const coord = (p: TrailPoint) => [p.longitude, p.latitude];
const fc = <T,>(features: T[]) => ({ type: 'FeatureCollection' as const, features });

/** Turns the API trail into MapLibre layers: route lines, gap segments, dots and S/E markers. */
export function trailToGeoJson(trail: LocationTrailResponse) {
  const bySession = new Map<string, TrailPoint[]>();
  for (const p of trail.points) bySession.set(p.sessionId, [...(bySession.get(p.sessionId) ?? []), p]);

  const routes: Line[] = [];
  const markers: Marker[] = [];
  for (const [sessionId, pts] of bySession) {
    const good = pts.filter((p) => p.qualityFlag === 'GOOD');
    if (good.length > 1) routes.push({ type: 'Feature', properties: { sessionId }, geometry: { type: 'LineString', coordinates: good.map(coord) } });
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    markers.push({ kind: 'start', sessionId, latitude: first.latitude, longitude: first.longitude, time: first.capturedAt });
    if (last !== first) markers.push({ kind: 'end', sessionId, latitude: last.latitude, longitude: last.longitude, time: last.capturedAt });
  }

  const gaps: Line[] = [];
  for (const g of trail.gaps) {
    const pts = bySession.get(g.sessionId) ?? [];
    const before = [...pts].reverse().find((p) => p.capturedAt <= g.from);
    const after = pts.find((p) => p.capturedAt >= g.to);
    if (before && after && before !== after) {
      gaps.push({ type: 'Feature', properties: { sessionId: g.sessionId }, geometry: { type: 'LineString', coordinates: [coord(before), coord(after)] } });
    }
  }

  const points: Dot[] = trail.points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, approximate: p.qualityFlag !== 'GOOD', capturedAt: p.capturedAt, accuracyMeters: p.accuracyMeters, speedMps: p.speedMps, source: p.source },
    geometry: { type: 'Point', coordinates: coord(p) },
  }));

  const lngs = trail.points.map((p) => p.longitude);
  const lats = trail.points.map((p) => p.latitude);
  const bounds = trail.points.length
    ? ([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]])
    : null;

  return { routes: fc(routes), gaps: fc(gaps), points: fc(points), markers, bounds };
}
```

`trail-summary.tsx`:
```tsx
import { formatInTimeZone } from 'date-fns-tz';
import type { LocationTrailResponse } from '@worktrail/types';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function TrailSummary({ trail }: { trail: LocationTrailResponse }) {
  const { stats, timezone: tz } = trail;
  if (stats.pointCount === 0) return <p className="text-ink-500">No locations recorded in this period.</p>;
  const time = (iso: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');
  return (
    <div className="space-y-2">
      <p className="font-medium text-ink-900">{`${plural(stats.pointCount, 'location')} · ${stats.distanceKm} km · ${plural(stats.gapCount, 'gap')}`}</p>
      {stats.lowAccuracyCount / stats.pointCount > 0.2 ? (
        <p className="text-sm text-ink-700">Some locations are approximate (accuracy worse than 100 m).</p>
      ) : null}
      {trail.truncated ? <p className="text-sm text-ink-700">Showing the first 5,000 locations. Choose a shorter period to see all of them.</p> : null}
      {trail.gaps.length ? (
        <ul className="space-y-1 text-sm text-ink-500">
          {trail.gaps.map((g) => (
            <li key={`${g.sessionId}-${g.from}`}>{`No location for ${g.minutes} min · ${time(g.from)} – ${time(g.to)}`}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

`trail-map.tsx` (client; loaded with `dynamic(..., { ssr: false })` from the page, like `locations-map.tsx`):
```tsx
'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import { useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Popup, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { formatInTimeZone } from 'date-fns-tz';
import type { LocationTrailResponse } from '@worktrail/types';
import { trailToGeoJson } from '@/lib/trail-geojson';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
type Picked = { lng: number; lat: number; capturedAt: string; accuracyMeters: number | null; speedMps: number | null; source: string };

export function TrailMap({ trail }: { trail: LocationTrailResponse }) {
  const ref = useRef<MapRef>(null);
  const geo = useMemo(() => trailToGeoJson(trail), [trail]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const time = (iso: string) => formatInTimeZone(new Date(iso), trail.timezone, 'EEE d MMM, h:mm a');

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return setPicked(null);
    const [lng, lat] = (f.geometry as { coordinates: number[] }).coordinates as [number, number];
    setPicked({ lng, lat, ...(f.properties as Omit<Picked, 'lng' | 'lat'>) });
  };

  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      initialViewState={geo.bounds ? { bounds: geo.bounds, fitBoundsOptions: { padding: 48, maxZoom: 16 } } : { latitude: 19.076, longitude: 72.8777, zoom: 10 }}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      interactiveLayerIds={['trail-points']}
      onClick={onClick}
      attributionControl={{ compact: true }}
    >
      <Source id="gaps" type="geojson" data={geo.gaps}>
        <Layer id="trail-gaps" type="line" paint={{ 'line-color': '#A9ACB0', 'line-width': 3, 'line-dasharray': [2, 2] }} />
      </Source>
      <Source id="routes" type="geojson" data={geo.routes}>
        <Layer id="trail-routes" type="line" paint={{ 'line-color': '#FE5A0C', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
      </Source>
      <Source id="points" type="geojson" data={geo.points}>
        <Layer
          id="trail-points"
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': ['case', ['get', 'approximate'], '#FFFFFF', '#FE5A0C'],
            'circle-stroke-color': ['case', ['get', 'approximate'], '#A9ACB0', '#FFFFFF'],
            'circle-stroke-width': 2,
          }}
        />
      </Source>
      {geo.markers.map((m) => (
        <Marker key={`${m.sessionId}-${m.kind}`} latitude={m.latitude} longitude={m.longitude} anchor="center">
          <span
            role="img"
            aria-label={`${m.kind === 'start' ? 'Start' : 'End'} · ${time(m.time)}`}
            className={`grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${m.kind === 'start' ? 'bg-success-500' : 'bg-ink-900'}`}
          >
            {m.kind === 'start' ? 'S' : 'E'}
          </span>
        </Marker>
      ))}
      {picked ? (
        <Popup latitude={picked.lat} longitude={picked.lng} onClose={() => setPicked(null)} closeOnClick={false}>
          <div className="space-y-0.5 text-sm">
            <p className="font-semibold">{time(picked.capturedAt)}</p>
            <p>Accuracy: {picked.accuracyMeters != null ? `${Math.round(picked.accuracyMeters)} m` : 'unknown'}</p>
            {picked.speedMps != null ? <p>Speed: {Math.round(picked.speedMps * 3.6)} km/h</p> : null}
            <p className="text-ink-500">{picked.source === 'START' ? 'Start work' : picked.source === 'END' ? 'End work' : 'Recorded every 5 minutes'}</p>
          </div>
        </Popup>
      ) : null}
    </Map>
  );
}
```
The `S` marker uses `bg-success-500` (green) and the `E` marker uses ink, matching the "green start / dark end" design note.

`map/page.tsx`:
```tsx
import dynamic from 'next/dynamic';
import type { LocationTrailResponse, MeResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { TrailSummary } from '@/components/employee-detail/trail-summary';
import { pageRange } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

const TrailMap = dynamic(() => import('@/components/employee-detail/trail-map').then((m) => m.TrailMap), {
  loading: () => <div className="size-full animate-pulse rounded-input bg-brand-50" />,
});

export default async function EmployeeMap({ params, searchParams }: PageProps<'/app/employees/[id]/map'>) {
  const { id } = await params;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(searchParams, me.company.timezone);
  const trail = await serverApi<LocationTrailResponse>(`/employees/${id}/location-trail?from=${range.from}&to=${range.to}`);
  return (
    <div className="space-y-6">
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="space-y-4 p-5">
        <TrailSummary trail={trail} />
        <div className="h-[520px] overflow-hidden rounded-input">
          <TrailMap trail={trail} />
        </div>
        <p className="flex flex-wrap gap-4 text-xs text-ink-500">
          <span>Orange line: route</span><span>Hollow dot: approximate location</span><span>Dashed line: no location received</span><span>S / E: start and end of work</span>
        </p>
      </Card>
    </div>
  );
}
```
In Next 16, a Server Component can't use `ssr: false` with `next/dynamic`. `trail-map.tsx` is already a client component, so the plain dynamic import above is enough. If the build complains about `window`, wrap `TrailMap` in a tiny client component that does `dynamic(..., { ssr: false })`, and ledger a ruling.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(web): employee route map with gaps, accuracy and point details"`

---

### Task 9: Work sessions page (web)

**Files:**
- Create: `apps/web/src/app/app/sessions/page.tsx`, `apps/web/src/components/sessions/sessions-table.tsx`, `apps/web/src/components/sessions/sessions-filters.tsx`, `apps/web/test/sessions.test.tsx`

**Interfaces:**
- Consumes: `WorkSessionsResponse`, `sessionLabel`, `WORK_SESSION_FILTERS` (Task 1), `parseRange`, `RangePicker`, `pageRange` (Task 6/7), and `serverApi`.
- Produces: route `/app/sessions` (query params `range`, `from`, `to`, `status`, `q`, `page`).

- [ ] **Step 1: Write the failing test.** `apps/web/test/sessions.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkSessionsResponse } from '@worktrail/types';
import { SessionsTable } from '@/components/sessions/sessions-table';

const data: WorkSessionsResponse = {
  timezone: 'Asia/Kolkata', page: 1, pageSize: 25, total: 2,
  items: [
    { id: 's1', employeeId: 'e1', employeeName: 'Amit Kumar', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null, pointCount: 110, leftRunning: false },
    { id: 's2', employeeId: 'e2', employeeName: 'Vikram Rao', status: 'ACTIVE', startedAt: '2026-10-04T03:30:00.000Z', endedAt: null, totalMinutes: null, lastLocationAt: null, pointCount: 90, leftRunning: true },
  ],
};

describe('SessionsTable', () => {
  it('shows each session with times, duration, locations and a clear status', () => {
    render(<SessionsTable data={data} />);
    const amit = screen.getByRole('row', { name: /Amit Kumar/ });
    expect(within(amit).getByText('Mon 5 Oct')).toBeInTheDocument();
    expect(within(amit).getByText('9:02 AM')).toBeInTheDocument();
    expect(within(amit).getByText('6:10 PM')).toBeInTheDocument();
    expect(within(amit).getByText('9h 8m')).toBeInTheDocument();
    expect(within(amit).getByText('110')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Vikram Rao/ })).getByText('Left running')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vikram Rao' })).toHaveAttribute('href', '/app/employees/e2/hours');
  });

  it('explains an empty result', () => {
    render(<SessionsTable data={{ ...data, items: [], total: 0 }} />);
    expect(screen.getByText('No work sessions in this period.')).toBeInTheDocument();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `sessions-table.tsx`:
```tsx
import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { sessionLabel, type WorkSessionsResponse } from '@worktrail/types';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/format';

const TONE: Record<string, string> = {
  Active: 'bg-success-50 text-success-500',
  'Left running': 'bg-brand-50 text-brand-700',
  Completed: 'bg-canvas text-ink-500',
  'Closed by admin': 'bg-canvas text-ink-700',
};

export function SessionsTable({ data }: { data: WorkSessionsResponse }) {
  const tz = data.timezone;
  const f = (iso: string, p: string) => formatInTimeZone(new Date(iso), tz, p);
  if (data.items.length === 0) return <p className="px-5 py-10 text-center text-ink-500">No work sessions in this period.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-ink-500">
        <tr>
          {['Employee', 'Date', 'Start', 'End', 'Duration', 'Locations', 'Status'].map((h) => (
            <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.items.map((s) => {
          const label = sessionLabel(s);
          const minutes = s.totalMinutes ?? Math.round((Date.now() - Date.parse(s.startedAt)) / 60_000);
          return (
            <tr key={s.id}>
              <th scope="row" className="px-5 py-3 font-normal">
                <Link href={`/app/employees/${s.employeeId}/hours`} className="font-semibold text-ink-900 hover:text-brand-700">{s.employeeName}</Link>
              </th>
              <td className="px-5 py-3">{f(s.startedAt, 'EEE d MMM')}</td>
              <td className="px-5 py-3">{f(s.startedAt, 'h:mm a')}</td>
              <td className="px-5 py-3">{s.endedAt ? f(s.endedAt, 'h:mm a') : '—'}</td>
              <td className="px-5 py-3 tabular-nums">{formatMinutes(minutes)}</td>
              <td className="px-5 py-3 tabular-nums">{s.pointCount}</td>
              <td className="px-5 py-3"><span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', TONE[label])}>{label}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

`sessions-filters.tsx`: a GET `<form action="/app/sessions">` holding:
- an employee search input (`name="q"`);
- a status `<select name="status">` with options All / Active / Left running / Completed / Closed by admin, mapping to `WORK_SESSION_FILTERS`;
- hidden `range`, `from` and `to` inputs that preserve the period;
- a **Filter** submit button.

It works without JavaScript, like the Phase 1b employees toolbar.

`app/app/sessions/page.tsx`:
```tsx
import type { Metadata } from 'next';
import type { MeResponse, WorkSessionsResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RangePicker } from '@/components/employee-detail/range-picker';
import { SessionsFilters } from '@/components/sessions/sessions-filters';
import { SessionsTable } from '@/components/sessions/sessions-table';
import { pageRange } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Work sessions · Work Trail' };

export default async function WorkSessionsPage({ searchParams }: PageProps<'/app/sessions'>) {
  const sp = await searchParams;
  const me = await serverApi<MeResponse>('/me');
  const { range, today } = await pageRange(Promise.resolve(sp), me.company.timezone);
  const qs = new URLSearchParams({ from: range.from, to: range.to, page: String(Number(sp.page) || 1) });
  if (typeof sp.status === 'string' && sp.status) qs.set('status', sp.status);
  if (typeof sp.q === 'string' && sp.q.trim()) qs.set('query', sp.q.trim());
  const data = await serverApi<WorkSessionsResponse>(`/work-sessions?${qs}`);
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h1 className="text-[28px] leading-tight">Work sessions</h1>
        <p className="mt-1 text-ink-500">Every start and end of work in your company.</p>
      </div>
      <RangePicker value={range} today={today} error={range.error} />
      <Card className="overflow-hidden">
        <SessionsFilters range={range} status={typeof sp.status === 'string' ? sp.status : ''} q={typeof sp.q === 'string' ? sp.q : ''} />
        <SessionsTable data={data} />
        <p className="border-t border-line px-5 py-3 text-sm text-ink-500">{data.total} sessions</p>
      </Card>
    </div>
  );
}
```
Add Previous/Next page links when `total > pageSize`, using the same pattern as the Phase 1b `Pagination` component but targeting `/app/sessions` and preserving `range`, `from`, `to`, `status` and `q`.

- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck && pnpm --filter @worktrail/web lint` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat(web): company-wide work sessions page"`

---

### Task 10: Browser check with seeded data

**Files:** none. If something breaks: write a failing test in the owning task's file, fix it, and commit as `fix(...)`.

- [ ] **Step 1: Start the stack** (memory-safe): `pnpm db:up`, re-seed, build and start the API from `dist`, then build the website and run `next start`. Don't run Metro at the same time.
- [ ] **Step 2: Walk through in Chrome** at 1440×900 and 390×844, signed in as `admin@demo.worktrail.in`:
  1. Dashboard → click "Amit Kumar" in Today's work hours. Expected: the employee page opens on Overview with the period Today and four cards.
  2. **This week** → the cards change. The URL has `?range=this-week`, and switching tabs keeps it.
  3. **Map**: orange route, green S and dark E markers, dots. Click a dot: popup with time, accuracy and source. Choose Vikram and **Yesterday**: one dashed gap of about 40 min listed as "No location for 40 min · 1:00 PM – 1:40 PM".
  4. **Map** with an empty period (Custom, a date before seeding): "No locations recorded in this period." and the map centred on Mumbai with no errors in the console.
  5. **Updates**: categories and Voice tags. Filter by Installation. Page 2 if there are more than 50.
  6. **Work hours** for Vikram, This week: the "Left running" banner → **Close session** → the dialog defaults to the last location time → close. Expected: the row shows "Closed by admin". The `audit_logs` table has `session.closed_by_admin`. If the demo phone was signed in as Vikram, its Home goes off duty on the next sync.
  7. **Work sessions** (sidebar): all sessions this week. Filter status "Left running" → none left after step 6. Search "Amit".
  8. Custom range of 40 days → "Choose at most 31 days." and Today is shown instead.
  9. Open `/app/employees/<another company's id>` (take an id from a second test company). Expected: Next.js 404 page, no data.
- [ ] **Step 3: Run the full suite.** `pnpm test` → every workspace passes.

---

## Open Questions (each has a default; tell me if any is wrong)

1. **What counts as a gap.** *Default: no location for more than 15 minutes during a session (three missed 5-minute targets).* Stricter (10 min) or looser (30 min)?
2. **"Left running" threshold.** *Default: a session still open 14 hours after it started.* The mobile app uses the same rule.
3. **Closing a forgotten session.** *Default: admins can close it at a chosen time (it becomes "Closed by admin" and is audited), but can't edit start times or delete sessions.* Should admins also be able to adjust a completed session's times?
4. **Week start.** *Default: Monday.* Some businesses count Sunday to Saturday.
5. **Distance.** *Default: only accurate points, ignoring jumps faster than 150 km/h (GPS glitches), shown as "Distance covered".* It's an estimate, since straight lines between 5-minute points under-count real roads. Should the UI label it "approximate"?
6. **The map for multi-day periods.** *Default: all sessions in the period on one map, one orange line per session.* Would you rather show one day at a time with day arrows?
