# Work Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Work Trail, a field-workforce MVP for Indian SMEs. It has three parts: an admin web dashboard, an Android-first employee app, and an API. Location is tracked only during a work session the employee starts. Employees send typed or voice updates, and the product produces AI summaries and PDF reports.

**Architecture:** A pnpm + Turborepo monorepo with three apps: `apps/api` (NestJS + Prisma + PostgreSQL, with Redis/BullMQ added in Phase 6), `apps/web` (Next.js admin dashboard) and `apps/mobile` (Expo employee app, Phase 2+). Two shared packages: `packages/types` holds Zod schemas and response types shared by all three apps. `packages/ui` holds the design tokens taken from the mockups, so the web and mobile apps look the same. The web app never handles tokens in browser JavaScript. Its own route handlers keep the API tokens in httpOnly cookies, and the Next.js proxy refreshes them.

**Tech Stack:** Node 22, pnpm 11, Turborepo, TypeScript, NestJS 11, Prisma 6, PostgreSQL 16 (PostGIS image), argon2, Zod 4, Next.js (latest) + Tailwind CSS 4 + React Hook Form + TanStack Query, MapLibre GL (`react-map-gl/maplibre`), Vitest + Testing Library (web/packages), Jest + supertest (API), Docker Compose.

**Spec:** `prd.pdf`, `plan.pdf`, `data-model.pdf`, `api-contract.pdf`, `build-prompt.pdf`, `ai-prompts.pdf` (repo root). **Visual spec:** `First 3 screens.png` (admin sign-up, admin login, admin dashboard) and `Landing page.png` (employee app welcome screen). The mockups replace the teal palette in `build-prompt.pdf`. Everything else in the PDFs still applies.

**Scope of this document:** Phases 0–1 (foundation, auth, organisation isolation, and the three designed admin screens running on seeded data) are written as complete, executable tasks. Phases 2–7 are milestone outlines at the end. Each one gets its own detailed plan when it starts, because each is a separate subsystem (mobile app, location pipeline, AI worker, PDF) that should be designed once the earlier phases have shipped.

## Global Constraints

- Brand name is exactly "Work Trail". In the logo, "Work" is ink and "Trail" is brand orange.
- Location tracking happens only between Start work and End work. Never build hidden or all-day tracking.
- Don't use "live" or "real-time" wording for data that isn't live (PRD §4 Location capture: "Do not claim continuous real-time tracking in v1").
- Every protected query is scoped to the caller's `companyId`. Requesting another company's resource returns 404, not 403.
- Roles are read from the server-signed token, never from the client.
- Passwords: argon2id hashes only.
- Database timestamps are stored in UTC. They are shown in the company timezone, which defaults to `Asia/Kolkata`.
- API base path is `/api/v1`. Error body is `{ "error": { "code", "message", "details" } }`.
- Work updates must be 5–2,000 characters after trimming (PRD §4).
- All AI output carries the label: "AI-generated summary based on submitted work updates and recorded work-session data."
- No secrets in the repo. Every variable goes in `.env.example`, and the API checks its environment at startup.
- Android 10+ first. No iOS-specific work in the MVP.
- Out of scope: payroll, expenses, route optimisation, task assignment, chat, facial recognition, geofencing alerts, performance scoring, iOS.
- Build order rule (plan.pdf): invite → employee login → start work → sync location → submit update → end work → admin sees data. AI, PDF and polished map analytics come after that path works.

## Design System (extracted from the mockups)

The whole product uses this system: web admin, employee app and future screens. The tokens live in `packages/ui/src/tokens.ts` (Task 3).

**Mood:** a warm, bright, trustworthy B2B tool. Warm off-white canvas, white cards, one confident orange, near-black ink. Map imagery is used only as soft illustration. There's no dark "surveillance" UI.

| Token | Hex | Where it shows in the mockups |
|---|---|---|
| `canvas` | `#FBF8F5` | Page background behind cards |
| `surface` | `#FFFFFF` | Cards, form panel, sidebar |
| `ink-900` | `#17130F` | Headings, "Work" in the logo, KPI numbers |
| `ink-700` | `#3A3631` | Body text |
| `ink-500` | `#6B6E72` | Secondary text, placeholders, inactive nav |
| `ink-300` | `#A9ACB0` | Disabled, input icons |
| `line` | `#ECE7E1` | Input borders, dividers |
| `brand-50` | `#FFF5EE` | Active nav pill, icon wells |
| `brand-100` | `#FFE8D7` | Selected segmented tab, auth panel gradient end |
| `brand-200` | `#FFCDA8` | Secondary button border |
| `brand-400` | `#FF7A2E` | CTA gradient start |
| `brand-500` | `#FE5A0C` | Primary orange: "Trail", CTA, icons, progress bars |
| `brand-600` | `#E84A00` | CTA gradient end, hover |
| `brand-700` | `#B83A00` | Small orange text on white (meets AA) |
| `success-50` | `#EAF7EF` | Positive chip background |
| `success-500` | `#1F9D55` | "↑ 12%" trend, working-now dot |
| `danger-500` | `#DC2626` | Errors only |

- **Gradients:** CTA `linear-gradient(90deg, #FF7A2E, #E84A00)`. Auth illustration panel `linear-gradient(180deg, #FFF3E8, #FFE6D2)`.
- **Type:** Barlow Semi Condensed 700 for headings, Barlow 400/500/600 for UI and body text. The mockups' narrow, heavy headings ("Create Company Account", "Welcome Back!") match this pairing. Scale: 40/32/24/20/16/14/12 px with line heights 1.1/1.15/1.25/1.3/1.5/1.45/1.4. Big auth headlines (40px) set the second line in `brand-500` ("visibility.", "Back!"), as the mockups do.
- **Shape:** inputs and buttons 12px radius. Cards 16px. Auth panels and the phone welcome sheet 20px. Pills 999px. Card shadow: `0 1px 2px rgba(23,19,15,.04), 0 8px 24px rgba(23,19,15,.06)`.
- **Components:**
  - Inputs: 48px tall, white, 1px `line` border, label above, and an `ink-300` icon on the left for the field types the mockups show (building, person, mail, phone, lock). Focus: 2px `brand-500` ring.
  - Primary button: 52px tall, CTA gradient, white 16px/600 label with a trailing arrow icon (an SVG, not a "→" text glyph).
  - Secondary button: white with a `brand-200` border and a `brand-600` label.
  - Segmented tabs (Email | Mobile OTP): `brand-100` fill on the selected tab.
- **Admin layouts:**
  - Auth pages: a two-column card on `canvas`. Left 42% is the illustration panel with the logo, a 40px headline, a supporting line and an illustration. On sign-up it also has three feature cards. Right 58% is the form, with a "Already have an account? Sign in" link in the top right. On screens narrower than 900px the illustration panel collapses to a 160px header band.
  - Dashboard: a 220px sidebar (logo, nav with the active item in a `brand-50` pill with `brand-500` text) and a top bar (collapse control, bell, avatar with name and role). Content is a greeting with a date picker on the right, then KPI cards in a row, then the locations card (map with the employee list), then "Recent updates" and "Today's work hours" side by side.
- **Employee mobile app:** the same tokens on a `canvas` background. The welcome screen follows `Landing page.png`: app icon tile, logo wordmark, tagline, an illustrated route with day stops, three value tiles, a primary "Get started" button and a secondary "Sign in" button.

## File Structure (Phases 0–1)

```
work-trail/                         (this repo root)
  package.json                      workspace root scripts
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  .prettierrc
  .gitignore
  .env.example                      every variable for api + web
  docker-compose.yml                postgres (postgis) + redis
  plan.md                           this file
  docs/specs/                       the six PDFs + three mockups, moved here in Task 1
  packages/
    types/                          @worktrail/types — Zod schemas + response types
      src/index.ts
      src/phone.ts                  normalizeIndianMobile()
      src/auth.ts                   AdminSignupSchema, LoginSchema, AuthUser, AuthTokens
      src/errors.ts                 ApiErrorBody
      src/dashboard.ts              DashboardResponse
      test/*.test.ts
    ui/                             @worktrail/ui — design tokens
      src/tokens.ts
      src/theme.css                 Tailwind v4 @theme generated from tokens
      test/tokens.test.ts           drift guard: theme.css matches tokens.ts
  apps/
    api/                            @worktrail/api — NestJS
      prisma/schema.prisma
      prisma/migrations/…
      prisma/seed.ts
      src/main.ts
      src/bootstrap.ts              createApp(): shared by main + tests
      src/app.module.ts
      src/config/env.ts
      src/common/app-error.ts
      src/common/error-envelope.filter.ts
      src/common/zod-body.pipe.ts
      src/common/time.ts            dayBounds(), minutesWithin()
      src/prisma/prisma.module.ts
      src/prisma/prisma.service.ts
      src/health/health.controller.ts
      src/auth/…                    module, controller, service, tokens, password, guards, decorators
      src/employees/…               list + detail (company-scoped)
      src/dashboard/…               GET /dashboard
      test/…                        jest e2e + helpers
    web/                            @worktrail/web — Next.js admin
      src/app/layout.tsx            fonts + theme
      src/app/(auth)/layout.tsx     split card
      src/app/(auth)/login/page.tsx
      src/app/(auth)/signup/page.tsx
      src/app/app/layout.tsx        sidebar + top bar shell
      src/app/app/dashboard/page.tsx
      src/app/api/session/[action]/route.ts   login | signup | logout BFF
      src/proxy.ts                  auth gate + silent refresh
      src/lib/session.ts            cookie names + set/clear
      src/lib/server-api.ts         serverApi() for Server Components
      src/lib/format.ts             formatMinutes, percentChange, greeting
      src/components/ui/…           Button, Input, Field, SegmentedTabs, Card
      src/components/auth/…         AuthPanel, SignupForm, LoginForm
      src/components/shell/…        Sidebar, Topbar
      src/components/dashboard/…    KpiCard, LocationsCard, RecentUpdates, WorkHours
      test/…
```

## Review Focus

1. **Cross-company ID guessing:** if Company A's admin requests `/employees/<Company B employee id>`, the expected response is 404 with no data, even with a valid token. Test in Task 7.
2. **Same email submitted twice at once** (a double-click on Create account): exactly one company and user are created and the second request gets 409 `EMAIL_TAKEN`, not 500. Test in Task 6.
3. **The IST day boundary:**
   - At 00:15 IST, "today" on the dashboard is the IST date, not the UTC date.
   - A session from 23:30 to 00:30 IST counts 30 minutes on each day.
   Tests in Task 8.
4. **Expired access token while the refresh token is still valid:**
   - The admin keeps working with no logout. The proxy refreshes and the page renders.
   - A refresh token that's used twice revokes every session for that user.
   Tests in Task 6 and Task 10.
5. **Indian mobile numbers typed loosely:** `98765 43210`, `09876543210`, `+91 98765-43210` and `919876543210` all normalise to `+919876543210`. `12345` and `5876543210` get a clear message. Test in Task 2 and Task 11.

---

## Phase 0–1 Tasks

### Task 1: Monorepo foundation and local infrastructure

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.prettierrc`, `.gitignore`, `.env.example`, `docker-compose.yml`
- Move: `*.pdf`, `Landing page.png`, `First 3 screens.png`, `Statistics Ui.jpg` → `docs/specs/`

**Interfaces:**
- Produces: root scripts `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm db:up`. A Postgres instance at `postgresql://worktrail:worktrail@localhost:5432/worktrail`, with a test database `worktrail_test`. Redis at `redis://localhost:6379`.

- [ ] **Step 1: Confirm the working tree.** Run `git status --short | head`. The old ProMap `App/` and `backend/` should show as deleted (` D`). Don't restore them. Commit the deletion as its own commit so history explains the reset:

```bash
git add -A App backend .gitignore README.md FieldIQ_Phase1_PRD.docx Shan.xlsx
git commit -m "chore: remove ProMap prototype ahead of Work Trail rebuild"
```

- [ ] **Step 2: Move the specs.**

```bash
mkdir -p docs/specs
git mv -k *.pdf docs/specs/ 2>/dev/null || mv *.pdf docs/specs/
mv "Landing page.png" "First 3 screens.png" "Statistics Ui.jpg" docs/specs/
```

- [ ] **Step 3: Write the root files.**

`package.json`:
```json
{
  "name": "work-trail",
  "private": true,
  "packageManager": "pnpm@11.24.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "format": "prettier --write .",
    "db:up": "docker compose up -d postgres redis"
  },
  "devDependencies": {
    "prettier": "^3",
    "turbo": "^2",
    "typescript": "^5.9"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - argon2
  - "@prisma/client"
  - "@prisma/engines"
  - prisma
  - esbuild
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

`.prettierrc`:
```json
{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.gitignore`:
```
node_modules/
dist/
.next/
.turbo/
coverage/
.env
.env.*
!.env.example
*.pem
.expo/
```

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: worktrail
      POSTGRES_PASSWORD: worktrail
      POSTGRES_DB: worktrail
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/init-test-db.sql:/docker-entrypoint-initdb.d/10-test-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U worktrail"]
      interval: 3s
      retries: 20
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

`infra/init-test-db.sql`:
```sql
CREATE DATABASE worktrail_test OWNER worktrail;
```

`.env.example`:
```
# ---- api ----
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://worktrail:worktrail@localhost:5432/worktrail
TEST_DATABASE_URL=postgresql://worktrail:worktrail@localhost:5432/worktrail_test
JWT_ACCESS_SECRET=replace-with-64-random-chars-replace-with-64-random-chars-0000
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
WEB_ORIGIN=http://localhost:3000
SEED_ADMIN_PASSWORD=WorkTrail@demo1
# ---- web ----
API_URL=http://localhost:4000
```

- [ ] **Step 4: Verify.**

Run: `pnpm install && pnpm db:up && docker compose ps`
Expected: `postgres` shows `healthy`, `redis` shows `running`. Then `docker compose exec postgres psql -U worktrail -lqt | cut -d'|' -f1 | grep -w worktrail_test` prints `worktrail_test`.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "chore: scaffold Work Trail monorepo and local postgres/redis"
```

---

### Task 2: Shared types package (`@worktrail/types`)

**Files:**
- Create: `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/src/{index,phone,auth,errors,dashboard}.ts`
- Test: `packages/types/test/phone.test.ts`, `packages/types/test/auth.test.ts`

**Interfaces:**
- Produces:
  - `normalizeIndianMobile(input: string): string | null`
  - `IndianMobileSchema` (Zod, outputs `+91XXXXXXXXXX`)
  - `AdminSignupSchema`, `LoginSchema`, `RefreshSchema` and their inferred `AdminSignupInput`, `LoginInput`
  - `Role = 'OWNER' | 'ADMIN' | 'EMPLOYEE'`
  - `AuthUser { id; role; companyId; name; email }`
  - `AuthTokens { accessToken; refreshToken; user: AuthUser }`
  - `ApiErrorBody { error: { code: string; message: string; details: Record<string, unknown> } }`
  - `DashboardResponse` (see code)

- [ ] **Step 1: Package setup.**

`packages/types/package.json`:
```json
{
  "name": "@worktrail/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4" },
  "devDependencies": { "vitest": "^3", "typescript": "^5.9" }
}
```

`packages/types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing tests.**

`packages/types/test/phone.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { normalizeIndianMobile, IndianMobileSchema } from '../src/phone.js';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['12345', '5876543210', '98765432101', '', 'abcdefghij'])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  it('schema reports a readable message', () => {
    const r = IndianMobileSchema.safeParse('12345');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');
  });
});
```

`packages/types/test/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { AdminSignupSchema, LoginSchema } from '../src/auth.js';

const valid = {
  companyName: 'Acme Services',
  name: 'Rahul Sharma',
  email: '  Rahul@Acme.IN ',
  phone: '98765 43210',
  password: 'StrongPass1',
};

describe('AdminSignupSchema', () => {
  it('trims, lowercases email and normalises phone', () => {
    const out = AdminSignupSchema.parse(valid);
    expect(out.email).toBe('rahul@acme.in');
    expect(out.phone).toBe('+919876543210');
  });

  it('rejects short passwords with a plain message', () => {
    const r = AdminSignupSchema.safeParse({ ...valid, password: 'short' });
    expect(r.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });
});

describe('LoginSchema', () => {
  it('normalises email', () => {
    expect(LoginSchema.parse({ email: ' A@B.IN', password: 'x' }).email).toBe('a@b.in');
  });
});
```

- [ ] **Step 3: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/types install && pnpm --filter @worktrail/types test`
Expected: FAIL. Imports can't be resolved (`../src/phone.js` does not exist).

- [ ] **Step 4: Implement.**

`packages/types/src/phone.ts`:
```ts
import { z } from 'zod';

/** Accepts common ways people type Indian mobiles; returns E.164 (+91XXXXXXXXXX) or null. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const IndianMobileSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeIndianMobile(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' });
    return z.NEVER;
  }
  return normalized;
});
```

`packages/types/src/auth.ts`:
```ts
import { z } from 'zod';
import { IndianMobileSchema } from './phone.js';

export const RoleSchema = z.enum(['OWNER', 'ADMIN', 'EMPLOYEE']);
export type Role = z.infer<typeof RoleSchema>;

const Email = z.string().trim().toLowerCase().email('Enter a valid email address.');
export const PasswordSchema = z.string().min(8, 'Use at least 8 characters.').max(128);

export const AdminSignupSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name.').max(160),
  name: z.string().trim().min(2, 'Enter your name.').max(160),
  email: Email,
  phone: IndianMobileSchema,
  password: PasswordSchema,
});
export type AdminSignupInput = z.output<typeof AdminSignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.output<typeof LoginSchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(20) });

export type AuthUser = { id: string; role: Role; companyId: string; name: string; email: string };
export type AuthTokens = { accessToken: string; refreshToken: string; user: AuthUser };
```

`packages/types/src/errors.ts`:
```ts
export type ApiErrorBody = {
  error: { code: string; message: string; details: Record<string, unknown> };
};
```

`packages/types/src/dashboard.ts`:
```ts
export type DashboardResponse = {
  date: string; // YYYY-MM-DD in company timezone
  timezone: string;
  kpis: {
    totalEmployees: number;
    workingNow: number;
    checkedInToday: number;
    workMinutesToday: number;
    workMinutesYesterday: number;
    updatesToday: number;
    updatesYesterday: number;
  };
  locations: Array<{
    employeeId: string;
    name: string;
    designation: string | null;
    status: 'WORKING' | 'OFF_DUTY';
    lastPoint: { latitude: number; longitude: number; capturedAt: string } | null;
  }>;
  recentUpdates: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    text: string;
    submittedAt: string;
  }>;
  workHours: Array<{ employeeId: string; name: string; minutes: number }>;
};
```

`packages/types/src/index.ts`:
```ts
export * from './phone.js';
export * from './auth.js';
export * from './errors.js';
export * from './dashboard.js';
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/types test && pnpm --filter @worktrail/types build`
Expected: PASS (15 tests), `dist/` emitted.

- [ ] **Step 6: Commit.**

```bash
git add packages/types
git commit -m "feat(types): shared auth schemas, Indian mobile normaliser, dashboard types"
```

---

### Task 3: Design tokens package (`@worktrail/ui`)

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/tokens.ts`, `packages/ui/src/theme.css`, `packages/ui/src/index.ts`
- Test: `packages/ui/test/tokens.test.ts`

**Interfaces:**
- Produces: `tokens` (`{ color, gradient, radius, shadow, font }`), consumed by mobile in Phase 2. `@worktrail/ui/theme.css` is a Tailwind v4 `@theme` file consumed by web in Task 9. Tailwind class names it provides: `bg-canvas`, `bg-surface`, `text-ink-900/700/500/300`, `border-line`, `bg-brand-50…700`, `text-success-500`, `bg-success-50`, `text-danger-500`, `rounded-input`, `rounded-card`, `rounded-panel`, `shadow-card`, `font-display`, `font-body`.

- [ ] **Step 1: Package setup.**

`packages/ui/package.json`:
```json
{
  "name": "@worktrail/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./theme.css": "./src/theme.css"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "devDependencies": { "vitest": "^3", "typescript": "^5.9" }
}
```
`packages/ui/tsconfig.json` is identical to the one in `packages/types`.

- [ ] **Step 2: Write the failing drift test.**

`packages/ui/test/tokens.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokens } from '../src/tokens.js';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefix}${k}`, v]] : flatten(v as Record<string, unknown>, `${prefix}${k}-`),
  );
}

describe('theme.css mirrors tokens.ts', () => {
  it.each(flatten(tokens.color))('--color-%s is %s', (name, hex) => {
    expect(css).toContain(`--color-${name}: ${hex};`);
  });

  it('declares radius and shadow tokens', () => {
    expect(css).toContain(`--radius-input: ${tokens.radius.input}px;`);
    expect(css).toContain(`--radius-card: ${tokens.radius.card}px;`);
    expect(css).toContain(`--radius-panel: ${tokens.radius.panel}px;`);
    expect(css).toContain(`--shadow-card: ${tokens.shadow.card};`);
  });
});
```

- [ ] **Step 3: Run it to verify it fails.**

Run: `pnpm --filter @worktrail/ui install && pnpm --filter @worktrail/ui test`
Expected: FAIL. `../src/tokens.js` not found.

- [ ] **Step 4: Implement.**

`packages/ui/src/tokens.ts`:
```ts
export const tokens = {
  color: {
    canvas: '#FBF8F5',
    surface: '#FFFFFF',
    line: '#ECE7E1',
    ink: { 900: '#17130F', 700: '#3A3631', 500: '#6B6E72', 300: '#A9ACB0' },
    brand: {
      50: '#FFF5EE',
      100: '#FFE8D7',
      200: '#FFCDA8',
      400: '#FF7A2E',
      500: '#FE5A0C',
      600: '#E84A00',
      700: '#B83A00',
    },
    success: { 50: '#EAF7EF', 500: '#1F9D55' },
    danger: { 500: '#DC2626' },
  },
  gradient: {
    cta: 'linear-gradient(90deg, #FF7A2E 0%, #E84A00 100%)',
    authPanel: 'linear-gradient(180deg, #FFF3E8 0%, #FFE6D2 100%)',
  },
  radius: { input: 12, card: 16, panel: 20, pill: 999 },
  shadow: { card: '0 1px 2px rgba(23,19,15,.04), 0 8px 24px rgba(23,19,15,.06)' },
  font: { display: 'Barlow Semi Condensed', body: 'Barlow' },
} as const;

export type Tokens = typeof tokens;
```

`packages/ui/src/index.ts`:
```ts
export * from './tokens.js';
```

`packages/ui/src/theme.css`:
```css
@theme {
  --color-canvas: #FBF8F5;
  --color-surface: #FFFFFF;
  --color-line: #ECE7E1;
  --color-ink-900: #17130F;
  --color-ink-700: #3A3631;
  --color-ink-500: #6B6E72;
  --color-ink-300: #A9ACB0;
  --color-brand-50: #FFF5EE;
  --color-brand-100: #FFE8D7;
  --color-brand-200: #FFCDA8;
  --color-brand-400: #FF7A2E;
  --color-brand-500: #FE5A0C;
  --color-brand-600: #E84A00;
  --color-brand-700: #B83A00;
  --color-success-50: #EAF7EF;
  --color-success-500: #1F9D55;
  --color-danger-500: #DC2626;

  --radius-input: 12px;
  --radius-card: 16px;
  --radius-panel: 20px;

  --shadow-card: 0 1px 2px rgba(23,19,15,.04), 0 8px 24px rgba(23,19,15,.06);

  --font-display: var(--font-barlow-semi-condensed), 'Barlow Semi Condensed', sans-serif;
  --font-body: var(--font-barlow), 'Barlow', sans-serif;
}

.bg-cta { background-image: linear-gradient(90deg, #FF7A2E 0%, #E84A00 100%); }
.bg-auth-panel { background-image: linear-gradient(180deg, #FFF3E8 0%, #FFE6D2 100%); }
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/ui test && pnpm --filter @worktrail/ui build`
Expected: PASS (18 tests).

- [ ] **Step 6: Commit.**

```bash
git add packages/ui
git commit -m "feat(ui): design tokens from mockups with css drift guard"
```

---

### Task 4: API skeleton with environment checks, error envelope and health check

**Files:**
- Create: `apps/api` via Nest CLI, then `src/bootstrap.ts`, `src/config/env.ts`, `src/common/app-error.ts`, `src/common/error-envelope.filter.ts`, `src/common/zod-body.pipe.ts`, `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`, `src/health/health.controller.ts`
- Modify: `src/main.ts`, `src/app.module.ts`
- Test: `apps/api/test/env.spec.ts`, `apps/api/test/health.e2e-spec.ts`, `apps/api/test/jest-e2e.json`, `apps/api/test/setup-env.ts`

**Interfaces:**
- Produces:
  - `loadEnv(raw?): Env` and the `ENV` injection token
  - `AppError(status, code, message, details?)`
  - `ZodBody(schema)` pipe
  - `PrismaService`
  - `createApp(): Promise<INestApplication>`, which sets the `/api/v1` prefix, the error filter, CORS for `WEB_ORIGIN` and Swagger at `/api/docs`
  - `GET /api/v1/health → { status: 'ok', db: 'up' }`

- [ ] **Step 1: Scaffold.**

```bash
cd apps && pnpm dlx @nestjs/cli@latest new api --package-manager pnpm --skip-git --strict && cd ..
pnpm --filter api pkg set name=@worktrail/api
pnpm --filter @worktrail/api add @nestjs/swagger @nestjs/jwt @nestjs/throttler @prisma/client@6 zod@^4 argon2 date-fns date-fns-tz @worktrail/types@workspace:*
pnpm --filter @worktrail/api add -D prisma@6 tsx dotenv-cli
```
Delete the generated `src/app.controller.ts`, `src/app.service.ts` and `src/app.controller.spec.ts`.

`PrismaService` needs a generated client before Task 5 adds models. Create a minimal `apps/api/prisma/schema.prisma` now. It contains only the `generator client { provider = "prisma-client-js" }` and `datasource db { provider = "postgresql" url = env("DATABASE_URL") }` blocks shown at the top of Task 5, Step 1. Then run `pnpm --filter @worktrail/api exec prisma generate`. Add `"postinstall": "prisma generate"` to `apps/api/package.json` so fresh clones generate the client.

- [ ] **Step 2: Write the failing tests.**

`apps/api/test/env.spec.ts`:
```ts
import { loadEnv } from '../src/config/env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(64),
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it('names every missing variable', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL.*JWT_ACCESS_SECRET/s);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
```

`apps/api/test/setup-env.ts`:
```ts
import { config } from 'dotenv';
config({ path: '../../.env' });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
```

`apps/api/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".(e2e-spec|spec).ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFiles": ["<rootDir>/setup-env.ts"],
  "maxWorkers": 1
}
```

`apps/api/test/health.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';

describe('health + error envelope', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /api/v1/health reports db up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('unknown route uses the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), details: {} },
    });
  });
});
```

Set the test scripts in `apps/api/package.json`: `"test": "jest --config test/jest-e2e.json"`, `"typecheck": "tsc --noEmit"`.

- [ ] **Step 3: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/api test`
Expected: FAIL. `Cannot find module '../src/config/env'` and `'../src/bootstrap'`.

- [ ] **Step 4: Implement.**

`src/config/env.ts`:
```ts
import { z } from 'zod';

export const ENV = Symbol('ENV');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
```

`src/common/app-error.ts`:
```ts
import { HttpException } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super({ error: { code, message, details } }, status);
  }
}
```

`src/common/error-envelope.filter.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        return res.status(status).json(body);
      }
      const raw = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? 'Request failed.');
      return res
        .status(status)
        .json({ error: { code: CODES[status] ?? 'ERROR', message, details: {} } });
    }
    this.logger.error(exception);
    return res.status(500).json({
      error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again.', details: {} },
    });
  }
}
```

`src/common/zod-body.pipe.ts`:
```ts
import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from './app-error';

export class ZodBody<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      throw new AppError(400, 'VALIDATION_FAILED', 'Some fields need attention.', { fields });
    }
    return result.data;
  }
}
```

`src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

`src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
```

`src/auth/public.decorator.ts` (created here because health uses it; Task 6 adds the guard that reads it):
```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
```

`src/config/config.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env';

@Global()
@Module({ providers: [{ provide: ENV, useFactory: () => loadEnv() }], exports: [ENV] })
export class ConfigModule {}
```

`src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
```

`src/bootstrap.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ErrorEnvelopeFilter } from './common/error-envelope.filter';
import { loadEnv } from './config/env';

export async function createApp() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { logger: env.NODE_ENV === 'test' ? false : undefined });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Work Trail API').setVersion('1').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  return app;
}
```

`src/main.ts`:
```ts
import 'dotenv/config';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main() {
  const app = await createApp();
  await app.listen(loadEnv().PORT);
}
void main();
```
Add `dotenv` with `pnpm --filter @worktrail/api add dotenv`, and set `"dev": "dotenv -e ../../.env -- nest start --watch"`.

- [ ] **Step 5: Run the tests to verify they pass.** The health test needs the schema from Task 5 only to connect, and an empty database answers `SELECT 1`.

Run: `cp .env.example .env && pnpm --filter @worktrail/api test`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit.**

```bash
git add apps/api .env.example
git commit -m "feat(api): nest skeleton with env validation, error envelope, health, swagger"
```

---

### Task 5: Database schema, migration and seed data

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/test/helpers/db.ts`
- Generated: `apps/api/prisma/migrations/<ts>_init/migration.sql` (then hand-edited)
- Test: `apps/api/test/schema.e2e-spec.ts`

**Interfaces:**
- Produces: Prisma models `Company, User, Employee, Invitation, RefreshToken, WorkSession, LocationPoint, WorkUpdate, GeneratedSummary, Report, AuditLog`, plus the enums below. Test helpers `resetDb(prisma)`, `makeCompany(prisma, overrides?)` and `makeEmployee(prisma, companyId, overrides?)`.
- Deviations from `data-model.pdf`, all deliberate:
  - `employees.name/email/phone` are added. The invitation holds a name before any `User` exists, and admin lists need it.
  - A `refresh_tokens` table is added. Refresh tokens are opaque, rotating and hashed.
  - User email is globally unique, so login needs only an email.

- [ ] **Step 1: Write the schema.**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole { OWNER ADMIN EMPLOYEE }
enum UserStatus { INVITED ACTIVE DISABLED }
enum SessionStatus { ACTIVE COMPLETED INCOMPLETE }
enum LocationSource { START BACKGROUND END MANUAL }
enum QualityFlag { GOOD LOW_ACCURACY SUSPICIOUS INVALID }
enum InputMethod { TYPED VOICE }
enum SummaryStatus { QUEUED PROCESSING COMPLETE FAILED }
enum PeriodType { DAILY WEEKLY MONTHLY }
enum ReportStatus { QUEUED GENERATING READY FAILED }

model Company {
  id                            String   @id @default(uuid()) @db.Uuid
  name                          String   @db.VarChar(160)
  timezone                      String   @default("Asia/Kolkata") @db.VarChar(64)
  preciseLocationRetentionDays  Int      @default(90) @map("precise_location_retention_days")
  createdAt                     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                     DateTime @updatedAt @map("updated_at") @db.Timestamptz
  users       User[]
  employees   Employee[]
  invitations Invitation[]
  sessions    WorkSession[]
  points      LocationPoint[]
  updates     WorkUpdate[]
  summaries   GeneratedSummary[]
  reports     Report[]
  auditLogs   AuditLog[]
  @@map("companies")
}

model User {
  id           String     @id @default(uuid()) @db.Uuid
  companyId    String     @map("company_id") @db.Uuid
  role         UserRole
  name         String     @db.VarChar(160)
  email        String     @unique @db.VarChar(254)
  phone        String?    @db.VarChar(24)
  passwordHash String     @map("password_hash")
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime   @updatedAt @map("updated_at") @db.Timestamptz
  company       Company        @relation(fields: [companyId], references: [id])
  employee      Employee?
  refreshTokens RefreshToken[]
  @@index([companyId])
  @@map("users")
}

model RefreshToken {
  id        String    @id @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("refresh_tokens")
}

model Employee {
  id           String   @id @default(uuid()) @db.Uuid
  companyId    String   @map("company_id") @db.Uuid
  userId       String?  @unique @map("user_id") @db.Uuid
  name         String   @db.VarChar(160)
  email        String?  @db.VarChar(254)
  phone        String?  @db.VarChar(24)
  employeeCode String?  @map("employee_code") @db.VarChar(80)
  designation  String?  @db.VarChar(120)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  company     Company            @relation(fields: [companyId], references: [id])
  user        User?              @relation(fields: [userId], references: [id])
  invitations Invitation[]
  sessions    WorkSession[]
  points      LocationPoint[]
  updates     WorkUpdate[]
  summaries   GeneratedSummary[]
  reports     Report[]
  @@unique([companyId, employeeCode])
  @@index([companyId])
  @@map("employees")
}

model Invitation {
  id              String    @id @default(uuid()) @db.Uuid
  companyId       String    @map("company_id") @db.Uuid
  employeeId      String    @map("employee_id") @db.Uuid
  tokenHash       String    @unique @map("token_hash")
  expiresAt       DateTime  @map("expires_at") @db.Timestamptz
  acceptedAt      DateTime? @map("accepted_at") @db.Timestamptz
  createdByUserId String    @map("created_by_user_id") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  company  Company  @relation(fields: [companyId], references: [id])
  employee Employee @relation(fields: [employeeId], references: [id])
  @@map("invitations")
}

model WorkSession {
  id              String        @id @default(uuid()) @db.Uuid
  companyId       String        @map("company_id") @db.Uuid
  employeeId      String        @map("employee_id") @db.Uuid
  status          SessionStatus @default(ACTIVE)
  startedAtServer DateTime      @map("started_at_server") @db.Timestamptz
  startedAtDevice DateTime?     @map("started_at_device") @db.Timestamptz
  endedAtServer   DateTime?     @map("ended_at_server") @db.Timestamptz
  endedAtDevice   DateTime?     @map("ended_at_device") @db.Timestamptz
  totalMinutes    Int?          @map("total_minutes")
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  company  Company         @relation(fields: [companyId], references: [id])
  employee Employee        @relation(fields: [employeeId], references: [id])
  points   LocationPoint[]
  updates  WorkUpdate[]
  @@index([employeeId, startedAtServer])
  @@index([companyId, startedAtServer])
  @@map("work_sessions")
}

model LocationPoint {
  id             String         @id @default(uuid()) @db.Uuid
  companyId      String         @map("company_id") @db.Uuid
  employeeId     String         @map("employee_id") @db.Uuid
  sessionId      String         @map("session_id") @db.Uuid
  clientPointId  String         @map("client_point_id") @db.Uuid
  latitude       Decimal        @db.Decimal(10, 7)
  longitude      Decimal        @db.Decimal(10, 7)
  accuracyMeters Decimal?       @map("accuracy_meters") @db.Decimal(8, 2)
  speedMps       Decimal?       @map("speed_mps")
  bearing        Decimal?
  batteryLevel   Decimal?       @map("battery_level") @db.Decimal(4, 3)
  source         LocationSource
  capturedAt     DateTime       @map("captured_at") @db.Timestamptz
  receivedAt     DateTime       @default(now()) @map("received_at") @db.Timestamptz
  qualityFlag    QualityFlag    @default(GOOD) @map("quality_flag")
  company  Company     @relation(fields: [companyId], references: [id])
  employee Employee    @relation(fields: [employeeId], references: [id])
  session  WorkSession @relation(fields: [sessionId], references: [id])
  @@unique([employeeId, clientPointId])
  @@index([employeeId, capturedAt])
  @@index([sessionId, capturedAt])
  @@index([companyId, capturedAt])
  @@map("location_points")
}

model WorkUpdate {
  id               String        @id @default(uuid()) @db.Uuid
  companyId        String        @map("company_id") @db.Uuid
  employeeId       String        @map("employee_id") @db.Uuid
  sessionId        String        @map("session_id") @db.Uuid
  text             String
  inputMethod      InputMethod   @map("input_method")
  category         String?       @db.VarChar(64)
  submittedAt      DateTime      @default(now()) @map("submitted_at") @db.Timestamptz
  summaryStatus    SummaryStatus @default(QUEUED) @map("summary_status")
  aiSummary        String?       @map("ai_summary")
  aiStructuredData Json?         @map("ai_structured_data")
  modelName        String?       @map("model_name") @db.VarChar(120)
  company  Company     @relation(fields: [companyId], references: [id])
  employee Employee    @relation(fields: [employeeId], references: [id])
  session  WorkSession @relation(fields: [sessionId], references: [id])
  @@index([companyId, submittedAt])
  @@index([employeeId, submittedAt])
  @@map("work_updates")
}

model GeneratedSummary {
  id                   String        @id @default(uuid()) @db.Uuid
  companyId            String        @map("company_id") @db.Uuid
  employeeId           String        @map("employee_id") @db.Uuid
  periodType           PeriodType    @map("period_type")
  periodStart          DateTime      @map("period_start") @db.Timestamptz
  periodEnd            DateTime      @map("period_end") @db.Timestamptz
  sourceUpdateCount    Int           @map("source_update_count")
  sourceSessionMinutes Int           @map("source_session_minutes")
  content              String?
  structuredData       Json?         @map("structured_data")
  status               SummaryStatus @default(QUEUED)
  generatedAt          DateTime?     @map("generated_at") @db.Timestamptz
  company  Company  @relation(fields: [companyId], references: [id])
  employee Employee @relation(fields: [employeeId], references: [id])
  @@unique([employeeId, periodType, periodStart, periodEnd])
  @@map("generated_summaries")
}

model Report {
  id                String       @id @default(uuid()) @db.Uuid
  companyId         String       @map("company_id") @db.Uuid
  employeeId        String       @map("employee_id") @db.Uuid
  requestedByUserId String       @map("requested_by_user_id") @db.Uuid
  periodStart       DateTime     @map("period_start") @db.Timestamptz
  periodEnd         DateTime     @map("period_end") @db.Timestamptz
  status            ReportStatus @default(QUEUED)
  storageKey        String?      @map("storage_key")
  generatedAt       DateTime?    @map("generated_at") @db.Timestamptz
  expiresAt         DateTime?    @map("expires_at") @db.Timestamptz
  company  Company  @relation(fields: [companyId], references: [id])
  employee Employee @relation(fields: [employeeId], references: [id])
  @@map("reports")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  companyId   String   @map("company_id") @db.Uuid
  actorUserId String?  @map("actor_user_id") @db.Uuid
  action      String   @db.VarChar(80)
  entityType  String   @map("entity_type") @db.VarChar(80)
  entityId    String?  @map("entity_id") @db.Uuid
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  company Company @relation(fields: [companyId], references: [id])
  @@index([companyId, createdAt])
  @@map("audit_logs")
}
```

- [ ] **Step 2: Create the migration and add the one-active-session rule.**

```bash
cd apps/api
pnpm dotenv -e ../../.env -- prisma migrate dev --name init --create-only
```
Append to the generated `prisma/migrations/<ts>_init/migration.sql`:
```sql
-- One ACTIVE session per employee (data-model.pdf).
CREATE UNIQUE INDEX "work_sessions_one_active_per_employee"
  ON "work_sessions" ("employee_id") WHERE "status" = 'ACTIVE';
```
Then apply it to both databases:
```bash
pnpm dotenv -e ../../.env -- prisma migrate dev
pnpm dotenv -e ../../.env -v DATABASE_URL=postgresql://worktrail:worktrail@localhost:5432/worktrail_test -- prisma migrate deploy
cd ../..
```
Add these scripts to `apps/api/package.json`:
```json
"db:migrate": "dotenv -e ../../.env -- prisma migrate dev",
"db:test:migrate": "dotenv -e ../../.env -v DATABASE_URL=postgresql://worktrail:worktrail@localhost:5432/worktrail_test -- prisma migrate deploy",
"db:seed": "dotenv -e ../../.env -- tsx prisma/seed.ts"
```

- [ ] **Step 3: Write the test helpers and the failing constraint test.**

`apps/api/test/helpers/db.ts`:
```ts
import { PrismaClient, type Company, type Employee } from '@prisma/client';

export async function resetDb(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

export function makeCompany(prisma: PrismaClient, overrides: Partial<Company> = {}) {
  return prisma.company.create({ data: { name: 'Test Co', ...overrides } });
}

export function makeEmployee(prisma: PrismaClient, companyId: string, overrides: Partial<Employee> = {}) {
  return prisma.employee.create({ data: { companyId, name: 'Ravi Kumar', ...overrides } });
}
```

`apps/api/test/schema.e2e-spec.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { makeCompany, makeEmployee, resetDb } from './helpers/db';

const prisma = new PrismaClient();

describe('schema rules', () => {
  beforeEach(() => resetDb(prisma));
  afterAll(() => prisma.$disconnect());

  it('allows only one ACTIVE session per employee', async () => {
    const c = await makeCompany(prisma);
    const e = await makeEmployee(prisma, c.id);
    const base = { companyId: c.id, employeeId: e.id, startedAtServer: new Date() };
    await prisma.workSession.create({ data: base });
    await expect(prisma.workSession.create({ data: base })).rejects.toMatchObject({ code: 'P2002' });
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
      companyId: c.id, employeeId: e.id, sessionId: s.id,
      clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
      latitude: 19.076, longitude: 72.8777, source: 'START' as const, capturedAt: new Date(),
    };
    await prisma.locationPoint.create({ data: point });
    await expect(prisma.locationPoint.create({ data: point })).rejects.toMatchObject({ code: 'P2002' });
  });
});
```

- [ ] **Step 4: Run it.** Run it once before the hand-edited migration is applied to the test database to see the first test fail. Then apply the migration and run again.

Run: `pnpm --filter @worktrail/api db:test:migrate && pnpm --filter @worktrail/api test -- schema`
Expected: PASS (3 tests). If the first test passes before the partial index exists, the index wasn't appended. Re-check Step 2.

- [ ] **Step 5: Write the seed data.** One company, one owner and five employees, with sessions, points every 5 minutes and updates for today and yesterday around Mumbai.

`apps/api/prisma/seed.ts`:
```ts
import { PrismaClient, type Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { format, subDays } from 'date-fns';

const prisma = new PrismaClient();
const TZ = 'Asia/Kolkata';

type Stop = [lat: number, lng: number];
const ROUTES: Record<string, Stop[]> = {
  'Amit Kumar': [[19.0176, 72.8562], [19.0330, 72.8570], [19.0544, 72.8406], [19.0596, 72.8295]],
  'Neha Patel': [[19.1136, 72.8697], [19.1197, 72.8468], [19.1075, 72.8263], [19.0990, 72.8260]],
  'Rohit Singh': [[18.9220, 72.8347], [18.9322, 72.8264], [18.9398, 72.8355], [18.9550, 72.8120]],
  'Pooja Verma': [[19.2183, 72.9781], [19.1972, 72.9707], [19.1860, 72.9750], [19.1726, 72.9563]],
  'Vikram Rao': [[19.0330, 73.0297], [19.0450, 73.0260], [19.0760, 72.9980], [19.0640, 72.9990]],
};
const DESIGNATIONS = ['Field Sales Executive', 'Service Technician', 'Site Supervisor', 'Merchandiser', 'Field Sales Executive'];
const UPDATES = [
  'Met purchase manager at ABC Traders. Discussed next quarter order of 40 units. Follow-up call on Friday.',
  'Completed installation at Sai Kripa Clinic. One sensor needs replacement, raised request with store.',
  'Site visit at Andheri warehouse done. Photos shared with client. Awaiting confirmation on layout.',
  'Follow-up call with Mehta Hardware done. They want a revised quote with delivery included.',
  'Stock audit at Thane outlet completed. Display shelf damaged, reported to area manager.',
];

function interpolate(route: Stop[], steps: number): Stop[] {
  const out: Stop[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * (route.length - 1);
    const a = route[Math.floor(t)]!;
    const b = route[Math.min(Math.ceil(t), route.length - 1)]!;
    const f = t - Math.floor(t);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

async function seedDay(companyId: string, employeeId: string, route: Stop[], day: Date, startHour: number, minutes: number, active: boolean, updateText: string) {
  const dayStr = format(day, 'yyyy-MM-dd');
  const start = fromZonedTime(`${dayStr}T${String(startHour).padStart(2, '0')}:00:00`, TZ);
  const now = new Date();
  const plannedEnd = new Date(start.getTime() + minutes * 60_000);
  const end = active ? (plannedEnd < now ? now : plannedEnd) : plannedEnd;
  const effectiveEnd = active ? now : end;
  if (start > now) return;
  const session = await prisma.workSession.create({
    data: {
      companyId, employeeId,
      status: active ? 'ACTIVE' : 'COMPLETED',
      startedAtServer: start, startedAtDevice: start,
      endedAtServer: active ? null : end, endedAtDevice: active ? null : end,
      totalMinutes: active ? null : minutes,
    },
  });
  const count = Math.max(2, Math.floor((effectiveEnd.getTime() - start.getTime()) / 300_000) + 1);
  const points: Prisma.LocationPointCreateManyInput[] = interpolate(route, count).map(([lat, lng], i) => ({
    companyId, employeeId, sessionId: session.id, clientPointId: randomUUID(),
    latitude: lat, longitude: lng, accuracyMeters: 12 + (i % 5) * 4,
    source: i === 0 ? 'START' : !active && i === count - 1 ? 'END' : 'BACKGROUND',
    capturedAt: new Date(start.getTime() + i * 300_000),
  }));
  await prisma.locationPoint.createMany({ data: points });
  await prisma.workUpdate.create({
    data: {
      companyId, employeeId, sessionId: session.id, text: updateText, inputMethod: 'VOICE',
      submittedAt: new Date(Math.min(start.getTime() + 95 * 60_000, now.getTime())), summaryStatus: 'QUEUED',
    },
  });
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error('Set SEED_ADMIN_PASSWORD in .env before seeding.');
  await prisma.company.deleteMany({ where: { name: 'Demo Field Services Pvt Ltd' } }).catch(() => undefined);

  const company = await prisma.company.create({ data: { name: 'Demo Field Services Pvt Ltd' } });
  await prisma.user.create({
    data: {
      companyId: company.id, role: 'OWNER', name: 'Rahul Sharma', email: 'admin@demo.worktrail.in',
      phone: '+919800000001', passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });

  const today = new Date();
  const names = Object.keys(ROUTES);
  for (const [i, name] of names.entries()) {
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id, name, designation: DESIGNATIONS[i] ?? null,
        employeeCode: `FT-${101 + i}`, phone: `+9198000001${10 + i}`,
      },
    });
    const route = ROUTES[name]!;
    await seedDay(company.id, employee.id, route, subDays(today, 1), 9, 420 + i * 15, false, UPDATES[(i + 1) % UPDATES.length]!);
    await seedDay(company.id, employee.id, route, today, 9, 360 + i * 10, i < 4, UPDATES[i]!);
  }
  console.log('Seeded demo company. Sign in as admin@demo.worktrail.in with SEED_ADMIN_PASSWORD.');
}

main().finally(() => prisma.$disconnect());
```
The `deleteMany` on a company with children fails on foreign keys. For a clean re-seed, run `pnpm --filter @worktrail/api exec prisma migrate reset --force --skip-seed` first. The `.catch` keeps the first run quiet.

- [ ] **Step 6: Run the seed.**

Run: `pnpm --filter @worktrail/api db:seed`
Expected: prints `Seeded demo company…`. Then run `docker compose exec postgres psql -U worktrail -c "select count(*) from location_points"`. Expected: a number greater than 300.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/prisma apps/api/test apps/api/package.json
git commit -m "feat(api): prisma schema, one-active-session index, Mumbai demo seed"
```

---

### Task 6: Authentication (signup, login, refresh, logout, me)

**Files:**
- Create in `apps/api/src/auth/`: `password.ts`, `tokens.service.ts`, `auth.service.ts`, `auth.controller.ts`, `jwt-auth.guard.ts`, `roles.guard.ts`, `roles.decorator.ts`, `current-auth.decorator.ts`, `auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `AdminSignupSchema`, `LoginSchema`, `RefreshSchema`, `AuthTokens`, `AuthUser` from `@worktrail/types`. `AppError`, `ZodBody`, `PrismaService`, `ENV`.
- Produces:
  - `POST /auth/signup/admin` (201) and `POST /auth/login` (200), both returning `AuthTokens`.
  - `POST /auth/refresh` (200) taking `{refreshToken}` and returning `AuthTokens`.
  - `POST /auth/logout` (204) taking `{refreshToken}`.
  - `GET /auth/me` returning `AuthUser`.
  - `AuthContext = { userId: string; companyId: string; role: Role }` on `req.auth`.
  - `@CurrentAuth()` parameter decorator and `@Roles(...roles)` decorator.
  - A global `JwtAuthGuard` that skips routes marked `@Public()`, and a global `RolesGuard`.
  - Refresh token format: `<uuid>.<base64url secret>`.

- [ ] **Step 1: Write the failing tests.**

`apps/api/test/auth.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/bootstrap';
import { resetDb } from './helpers/db';

const prisma = new PrismaClient();
const signup = {
  companyName: 'Acme Services',
  name: 'Rahul Sharma',
  email: 'rahul@acme.in',
  phone: '98765 43210',
  password: 'StrongPass1',
};

describe('auth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  beforeEach(() => resetDb(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('signup creates company + OWNER and returns tokens', async () => {
    const res = await http().post('/api/v1/auth/signup/admin').send(signup).expect(201);
    expect(res.body.user).toMatchObject({ role: 'OWNER', name: 'Rahul Sharma', email: 'rahul@acme.in' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toMatch(/^[0-9a-f-]{36}\.[\w-]+$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'rahul@acme.in' } });
    expect(user.phone).toBe('+919876543210');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('concurrent signups with one email create exactly one account', async () => {
    const [a, b] = await Promise.all([
      http().post('/api/v1/auth/signup/admin').send(signup),
      http().post('/api/v1/auth/signup/admin').send({ ...signup, companyName: 'Other' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.company.count()).toBe(1);
  });

  it('signup validation returns field messages', async () => {
    const res = await http().post('/api/v1/auth/signup/admin').send({ ...signup, phone: '12345' }).expect(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { fields: { phone: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' } },
    });
  });

  it('login succeeds with any email casing and fails with one generic message', async () => {
    await http().post('/api/v1/auth/signup/admin').send(signup).expect(201);
    await http().post('/api/v1/auth/login').send({ email: 'RAHUL@acme.in', password: 'StrongPass1' }).expect(200);
    const wrong = await http().post('/api/v1/auth/login').send({ email: 'rahul@acme.in', password: 'nope' }).expect(401);
    const missing = await http().post('/api/v1/auth/login').send({ email: 'x@acme.in', password: 'nope' }).expect(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('me requires a bearer token', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    await http().get('/api/v1/auth/me').expect(401);
    const me = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    expect(me.body).toEqual(body.user);
  });

  it('refresh rotates; reusing an old refresh token revokes the whole family', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    const r1 = await http().post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(200);
    expect(r1.body.refreshToken).not.toBe(body.refreshToken);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const { body } = await http().post('/api/v1/auth/signup/admin').send(signup);
    await http().post('/api/v1/auth/logout').send({ refreshToken: body.refreshToken }).expect(204);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
  });

  it('disabled users cannot log in', async () => {
    await http().post('/api/v1/auth/signup/admin').send(signup);
    await prisma.user.update({ where: { email: 'rahul@acme.in' }, data: { status: 'DISABLED' } });
    const res = await http().post('/api/v1/auth/login').send({ email: 'rahul@acme.in', password: 'StrongPass1' }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/api test -- auth`
Expected: FAIL. `POST /api/v1/auth/signup/admin` returns 404.

- [ ] **Step 3: Implement.**

`src/auth/password.ts`:
```ts
import argon2 from 'argon2';

export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain).catch(() => false);

let dummy: Promise<string> | undefined;
/** Burn equivalent time when the email is unknown so response timing doesn't reveal accounts. */
export const verifyAgainstDummy = async (plain: string) => {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummy, plain);
  return false;
};
```

`src/auth/roles.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '@worktrail/types';
export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
```

`src/auth/current-auth.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@worktrail/types';

export type AuthContext = { userId: string; companyId: string; role: Role };

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<{ auth: AuthContext }>().auth;
});
```

`src/auth/jwt-auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@worktrail/types';
import { AppError } from '../common/app-error';
import { ENV, type Env } from '../config/env';
import { IS_PUBLIC } from './public.decorator';
import type { AuthContext } from './current-auth.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; auth?: AuthContext }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; cid: string; role: Role }>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      req.auth = { userId: p.sub, companyId: p.cid, role: p.role };
      return true;
    } catch {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Sign in again.');
    }
  }
}
```

`src/auth/roles.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@worktrail/types';
import { AppError } from '../common/app-error';
import { ROLES } from './roles.decorator';
import type { AuthContext } from './current-auth.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const auth = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>().auth;
    if (!auth || !roles.includes(auth.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Your role does not allow this action.');
    }
    return true;
  }
}
```

`src/auth/tokens.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { AuthTokens, AuthUser } from '@worktrail/types';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { addDays } from 'date-fns';
import { AppError } from '../common/app-error';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const expired = () => new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id, role: u.role, companyId: u.companyId, name: u.name, email: u.email,
});

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issue(user: User): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, cid: user.companyId, role: user.role },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS },
    );
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        id, userId: user.id, tokenHash: sha256(secret),
        expiresAt: addDays(new Date(), this.env.REFRESH_TOKEN_TTL_DAYS),
      },
    });
    return { accessToken, refreshToken: `${id}.${secret}`, user: toAuthUser(user) };
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    const [id, secret] = refreshToken.split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) throw expired();
    const row = await this.prisma.refreshToken.findUnique({ where: { id }, include: { user: true } });
    if (!row || row.tokenHash !== sha256(secret)) throw expired();
    if (row.revokedAt) {
      // Reuse of a rotated token: treat as theft and end every session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw expired();
    }
    if (row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw expired();
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) throw expired();
    return this.issue(row.user);
  }

  async revoke(refreshToken: string) {
    const [id] = refreshToken.split('.');
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return;
    await this.prisma.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
```

`src/auth/auth.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminSignupInput, AuthTokens, LoginInput } from '@worktrail/types';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password';
import { TokensService, toAuthUser } from './tokens.service';

const emailTaken = () =>
  new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async signupAdmin(input: AdminSignupInput): Promise<AuthTokens> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({ data: { name: input.companyName } });
        return tx.user.create({
          data: {
            companyId: company.id, role: 'OWNER', name: input.name,
            email: input.email, phone: input.phone, passwordHash,
          },
        });
      });
      return this.tokens.issue(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw emailTaken();
      throw e;
    }
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user ? await verifyPassword(user.passwordHash, input.password) : await verifyAgainstDummy(input.password);
    if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled. Contact your company admin.');
    }
    return this.tokens.issue(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    return toAuthUser(user);
  }
}
```

`src/auth/auth.controller.ts`:
```ts
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdminSignupSchema, LoginSchema, RefreshSchema,
  type AdminSignupInput, type LoginInput,
} from '@worktrail/types';
import { ZodBody } from '../common/zod-body.pipe';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { Public } from './public.decorator';
import { CurrentAuth, type AuthContext } from './current-auth.decorator';

// Strict in real use; relaxed under test so suites that sign up many companies don't hit 429.
const AUTH_LIMIT = { default: { limit: process.env.NODE_ENV === 'test' ? 10_000 : 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('signup/admin')
  signup(@Body(new ZodBody(AdminSignupSchema)) body: AdminSignupInput) {
    return this.auth.signupAdmin(body);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodBody(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodBody(RefreshSchema)) body: { refreshToken: string }) {
    return this.tokens.rotate(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodBody(RefreshSchema)) body: { refreshToken: string }) {
    await this.tokens.revoke(body.refreshToken);
  }

  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId);
  }
}
```

`src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokensService],
  exports: [JwtModule],
})
export class AuthModule {}
```

Replace `src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: process.env.NODE_ENV === 'test' ? 10_000 : 120 }]),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/api test`
Expected: PASS (all suites, 16 tests).

- [ ] **Step 5: Commit.**

```bash
git add apps/api
git commit -m "feat(api): admin signup, login, rotating refresh tokens, logout, me"
```

---

### Task 7: Organisation isolation and the employees endpoints

**Files:**
- Create: `apps/api/src/employees/employees.module.ts`, `employees.controller.ts`, `employees.service.ts`
- Modify: `apps/api/src/app.module.ts` (import `EmployeesModule`)
- Test: `apps/api/test/isolation.e2e-spec.ts`, `apps/api/test/helpers/auth.ts`

**Interfaces:**
- Consumes: `AuthContext`, `@Roles`, `@CurrentAuth`, `PrismaService`, `AppError`.
- Produces:
  - `GET /employees?query=&status=&page=1&pageSize=20` returns `{ items: EmployeeListItem[]; page; pageSize; total }`. `EmployeeListItem = { id; name; designation; employeeCode; status: 'WORKING' | 'OFF_DUTY' }`.
  - `GET /employees/:id` returns `EmployeeListItem`. 404 for another company's id.
  - Test helper `signupAs(app, overrides?) → { token, user }`.

- [ ] **Step 1: Write the failing tests.**

`apps/api/test/helpers/auth.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { AuthTokens } from '@worktrail/types';

let n = 0;
export async function signupAs(app: INestApplication, overrides: Record<string, string> = {}) {
  n += 1;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/signup/admin')
    .send({
      companyName: `Co ${n}`, name: `Admin ${n}`, email: `admin${n}@co${n}.in`,
      phone: '9876543210', password: 'StrongPass1', ...overrides,
    })
    .expect(201);
  const body = res.body as AuthTokens;
  return { token: body.accessToken, user: body.user };
}
```

`apps/api/test/isolation.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/bootstrap';
import { makeEmployee, resetDb } from './helpers/db';
import { signupAs } from './helpers/auth';

const prisma = new PrismaClient();

describe('organisation isolation', () => {
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

  it('lists only own-company employees', async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    await makeEmployee(prisma, a.user.companyId, { name: 'Asha' });
    await makeEmployee(prisma, b.user.companyId, { name: 'Bilal' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/employees').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(res.body.items.map((e: { name: string }) => e.name)).toEqual(['Asha']);
    expect(res.body.total).toBe(1);
  });

  it("returns 404 for another company's employee id", async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    const theirs = await makeEmployee(prisma, b.user.companyId);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/employees/${theirs.id}`).set('Authorization', `Bearer ${a.token}`).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 (not 500) for a malformed id', async () => {
    const a = await signupAs(app);
    await request(app.getHttpServer())
      .get('/api/v1/employees/not-a-uuid').set('Authorization', `Bearer ${a.token}`).expect(404);
  });

  it('marks employees with an ACTIVE session as WORKING and filters by status', async () => {
    const a = await signupAs(app);
    const e1 = await makeEmployee(prisma, a.user.companyId, { name: 'Asha' });
    await makeEmployee(prisma, a.user.companyId, { name: 'Bina' });
    await prisma.workSession.create({
      data: { companyId: a.user.companyId, employeeId: e1.id, startedAtServer: new Date() },
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/employees?status=WORKING').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(res.body.items).toEqual([expect.objectContaining({ name: 'Asha', status: 'WORKING' })]);
  });

  it('forbids EMPLOYEE role from the admin list', async () => {
    const a = await signupAs(app);
    await prisma.user.update({ where: { id: a.user.id }, data: { role: 'EMPLOYEE' } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login').send({ email: a.user.email, password: 'StrongPass1' });
    await request(app.getHttpServer())
      .get('/api/v1/employees').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/api test -- isolation`
Expected: FAIL. `/api/v1/employees` returns 404 `Cannot GET`.

- [ ] **Step 3: Implement.**

`src/employees/employees.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';

export type EmployeeListItem = {
  id: string;
  name: string;
  designation: string | null;
  employeeCode: string | null;
  status: 'WORKING' | 'OFF_DUTY';
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const select = {
  id: true, name: true, designation: true, employeeCode: true,
  sessions: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 },
} satisfies Prisma.EmployeeSelect;

type Row = Prisma.EmployeeGetPayload<{ select: typeof select }>;
const toItem = (r: Row): EmployeeListItem => ({
  id: r.id, name: r.name, designation: r.designation, employeeCode: r.employeeCode,
  status: r.sessions.length ? 'WORKING' : 'OFF_DUTY',
});

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, q: { query?: string; status?: string; page: number; pageSize: number }) {
    const where: Prisma.EmployeeWhereInput = { companyId };
    if (q.query) where.name = { contains: q.query, mode: 'insensitive' };
    if (q.status === 'WORKING') where.sessions = { some: { status: 'ACTIVE' } };
    if (q.status === 'OFF_DUTY') where.sessions = { none: { status: 'ACTIVE' } };
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where, select, orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: rows.map(toItem), page: q.page, pageSize: q.pageSize, total };
  }

  async get(companyId: string, id: string) {
    const notFound = new AppError(404, 'NOT_FOUND', 'Employee not found.');
    if (!UUID.test(id)) throw notFound;
    const row = await this.prisma.employee.findFirst({ where: { id, companyId }, select });
    if (!row) throw notFound;
    return toItem(row);
  }
}
```

`src/employees/employees.controller.ts`:
```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentAuth, type AuthContext } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { EmployeesService } from './employees.service';

const clampInt = (v: string | undefined, def: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

@Roles('OWNER', 'ADMIN')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query('query') query?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.employees.list(auth.companyId, {
      query: query?.trim() || undefined,
      status,
      page: clampInt(page, 1, 10_000),
      pageSize: clampInt(pageSize, 20, 100),
    });
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.employees.get(auth.companyId, id);
  }
}
```

`src/employees/employees.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}
```
Add `EmployeesModule` to the `imports` in `app.module.ts`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/api test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit.**

```bash
git add apps/api
git commit -m "feat(api): company-scoped employees list/detail with isolation tests"
```

---

### Task 8: Dashboard endpoint with timezone-correct days

**Files:**
- Create: `apps/api/src/common/time.ts`, `apps/api/src/dashboard/dashboard.module.ts`, `dashboard.controller.ts`, `dashboard.service.ts`
- Modify: `apps/api/src/app.module.ts` (import `DashboardModule`)
- Test: `apps/api/test/time.spec.ts`, `apps/api/test/dashboard.e2e-spec.ts`

**Interfaces:**
- Consumes: `DashboardResponse` from `@worktrail/types`, `AuthContext`, `PrismaService`.
- Produces:
  - `todayIn(tz, now?): string` (YYYY-MM-DD)
  - `dayBounds(date: string, tz: string): { start: Date; end: Date }`
  - `minutesWithin(sessions: Array<{ start: Date; end: Date | null }>, start: Date, end: Date, now: Date): number`
  - `GET /dashboard?date=YYYY-MM-DD` returns `DashboardResponse`. It defaults to today in the company timezone. An invalid date returns 400 `INVALID_DATE`.

- [ ] **Step 1: Write the failing unit tests.**

`apps/api/test/time.spec.ts`:
```ts
import { dayBounds, minutesWithin, todayIn } from '../src/common/time';

const TZ = 'Asia/Kolkata';

describe('time helpers', () => {
  it('todayIn uses the company timezone, not UTC', () => {
    // 2026-10-04 00:15 IST == 2026-10-03 18:45 UTC
    expect(todayIn(TZ, new Date('2026-10-03T18:45:00Z'))).toBe('2026-10-04');
  });

  it('dayBounds spans IST midnight to midnight', () => {
    const { start, end } = dayBounds('2026-10-04', TZ);
    expect(start.toISOString()).toBe('2026-10-03T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });

  it('splits a session across midnight', () => {
    const s = [{ start: new Date('2026-10-03T18:00:00Z'), end: new Date('2026-10-03T19:00:00Z') }]; // 23:30–00:30 IST
    const d3 = dayBounds('2026-10-03', TZ);
    const d4 = dayBounds('2026-10-04', TZ);
    const now = new Date('2026-10-05T00:00:00Z');
    expect(minutesWithin(s, d3.start, d3.end, now)).toBe(30);
    expect(minutesWithin(s, d4.start, d4.end, now)).toBe(30);
  });

  it('counts an open session up to now', () => {
    const d = dayBounds('2026-10-04', TZ);
    const now = new Date('2026-10-04T05:30:00Z'); // 11:00 IST
    const s = [{ start: new Date('2026-10-04T03:30:00Z'), end: null }]; // 09:00 IST
    expect(minutesWithin(s, d.start, d.end, now)).toBe(120);
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/api test -- time`
Expected: FAIL. `Cannot find module '../src/common/time'`.

- [ ] **Step 3: Implement the time helpers.**

`src/common/time.ts`:
```ts
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, parseISO } from 'date-fns';

export const todayIn = (tz: string, now = new Date()) => formatInTimeZone(now, tz, 'yyyy-MM-dd');

export function dayBounds(date: string, tz: string) {
  const start = fromZonedTime(`${date}T00:00:00`, tz);
  const next = formatInTimeZone(addDays(parseISO(`${date}T12:00:00Z`), 1), 'UTC', 'yyyy-MM-dd');
  return { start, end: fromZonedTime(`${next}T00:00:00`, tz) };
}

export function minutesWithin(
  sessions: Array<{ start: Date; end: Date | null }>,
  start: Date,
  end: Date,
  now: Date,
) {
  let ms = 0;
  for (const s of sessions) {
    const from = Math.max(s.start.getTime(), start.getTime());
    const to = Math.min((s.end ?? now).getTime(), end.getTime(), now.getTime());
    if (to > from) ms += to - from;
  }
  return Math.round(ms / 60_000);
}

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());
```

Run: `pnpm --filter @worktrail/api test -- time`
Expected: PASS (4 tests).

- [ ] **Step 4: Write the failing end-to-end test.**

`apps/api/test/dashboard.e2e-spec.ts`:
```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/bootstrap';
import { formatInTimeZone } from 'date-fns-tz';
import { dayBounds } from '../src/common/time';
import { makeEmployee, resetDb } from './helpers/db';
import { signupAs } from './helpers/auth';

const prisma = new PrismaClient();

describe('GET /dashboard', () => {
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

  it('aggregates only own-company data for the IST day', async () => {
    const a = await signupAs(app);
    const b = await signupAs(app);
    const cid = a.user.companyId;
    // Use yesterday (IST) so the fixed 3h–5h session is fully in the past whenever the suite runs.
    const day = formatInTimeZone(new Date(Date.now() - 86_400_000), 'Asia/Kolkata', 'yyyy-MM-dd');
    const { start } = dayBounds(day, 'Asia/Kolkata');
    const amit = await makeEmployee(prisma, cid, { name: 'Amit Kumar', designation: 'Field Sales' });
    await makeEmployee(prisma, cid, { name: 'Neha Patel' });
    await makeEmployee(prisma, b.user.companyId, { name: 'Other Co Person' });

    const s = await prisma.workSession.create({
      data: {
        companyId: cid, employeeId: amit.id, status: 'COMPLETED',
        startedAtServer: new Date(start.getTime() + 3 * 3600_000),
        endedAtServer: new Date(start.getTime() + 5 * 3600_000),
      },
    });
    await prisma.locationPoint.create({
      data: {
        companyId: cid, employeeId: amit.id, sessionId: s.id,
        clientPointId: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f',
        latitude: 19.076, longitude: 72.8777, source: 'END',
        capturedAt: new Date(start.getTime() + 5 * 3600_000),
      },
    });
    await prisma.workUpdate.create({
      data: { companyId: cid, employeeId: amit.id, sessionId: s.id, text: 'Met client at ABC Traders.', inputMethod: 'TYPED', submittedAt: new Date(start.getTime() + 4 * 3600_000) },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/dashboard?date=${day}`).set('Authorization', `Bearer ${a.token}`).expect(200);

    expect(res.body.date).toBe(day);
    expect(res.body.timezone).toBe('Asia/Kolkata');
    expect(res.body.kpis).toMatchObject({
      totalEmployees: 2, workingNow: 0, checkedInToday: 1,
      workMinutesToday: 120, updatesToday: 1, updatesYesterday: 0,
    });
    expect(res.body.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Amit Kumar', status: 'OFF_DUTY', lastPoint: expect.objectContaining({ latitude: 19.076 }) }),
        expect.objectContaining({ name: 'Neha Patel', lastPoint: null }),
      ]),
    );
    expect(res.body.recentUpdates[0]).toMatchObject({ employeeName: 'Amit Kumar', text: 'Met client at ABC Traders.' });
    expect(res.body.workHours).toEqual([{ employeeId: amit.id, name: 'Amit Kumar', minutes: 120 }]);
    expect(JSON.stringify(res.body)).not.toContain('Other Co Person');
  });

  it('rejects a bad date', async () => {
    const a = await signupAs(app);
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard?date=2026-13-45').set('Authorization', `Bearer ${a.token}`).expect(400);
    expect(res.body.error.code).toBe('INVALID_DATE');
  });
});
```

Run: `pnpm --filter @worktrail/api test -- dashboard`
Expected: FAIL. 404 for `/api/v1/dashboard`.

- [ ] **Step 5: Implement the endpoint.**

`src/dashboard/dashboard.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { DashboardResponse } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays, parseISO } from 'date-fns';
import { AppError } from '../common/app-error';
import { dayBounds, isIsoDate, minutesWithin, todayIn } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, dateParam?: string): Promise<DashboardResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const tz = company.timezone;
    const date = dateParam ?? todayIn(tz);
    if (!isIsoDate(date)) throw new AppError(400, 'INVALID_DATE', 'Use a date in the format YYYY-MM-DD.');
    const now = new Date();
    const day = dayBounds(date, tz);
    const yDate = formatInTimeZone(subDays(parseISO(`${date}T12:00:00Z`), 1), 'UTC', 'yyyy-MM-dd');
    const yesterday = dayBounds(yDate, tz);

    const [employees, sessions, updatesToday, updatesYesterday, recent, lastPoints] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId },
        select: { id: true, name: true, designation: true, sessions: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workSession.findMany({
        where: {
          companyId,
          startedAtServer: { lt: day.end },
          OR: [{ endedAtServer: null }, { endedAtServer: { gt: yesterday.start } }],
        },
        select: { employeeId: true, startedAtServer: true, endedAtServer: true },
      }),
      this.prisma.workUpdate.count({ where: { companyId, submittedAt: { gte: day.start, lt: day.end } } }),
      this.prisma.workUpdate.count({ where: { companyId, submittedAt: { gte: yesterday.start, lt: yesterday.end } } }),
      this.prisma.workUpdate.findMany({
        where: { companyId, submittedAt: { gte: day.start, lt: day.end } },
        orderBy: { submittedAt: 'desc' },
        take: 8,
        select: { id: true, employeeId: true, text: true, submittedAt: true, employee: { select: { name: true } } },
      }),
      this.prisma.locationPoint.findMany({
        where: { companyId, capturedAt: { lt: day.end } },
        orderBy: { capturedAt: 'desc' },
        distinct: ['employeeId'],
        select: { employeeId: true, latitude: true, longitude: true, capturedAt: true },
      }),
    ]);

    const span = (s: (typeof sessions)[number]) => ({ start: s.startedAtServer, end: s.endedAtServer });
    const minutesFor = (empId: string, b: { start: Date; end: Date }) =>
      minutesWithin(sessions.filter((s) => s.employeeId === empId).map(span), b.start, b.end, now);
    const pointBy = new Map(lastPoints.map((p) => [p.employeeId, p]));

    const workHours = employees
      .map((e) => ({ employeeId: e.id, name: e.name, minutes: minutesFor(e.id, day) }))
      .filter((w) => w.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    return {
      date,
      timezone: tz,
      kpis: {
        totalEmployees: employees.length,
        workingNow: employees.filter((e) => e.sessions.length).length,
        checkedInToday: workHours.length,
        workMinutesToday: workHours.reduce((n, w) => n + w.minutes, 0),
        workMinutesYesterday: employees.reduce((n, e) => n + minutesFor(e.id, yesterday), 0),
        updatesToday,
        updatesYesterday,
      },
      locations: employees.map((e) => {
        const p = pointBy.get(e.id);
        return {
          employeeId: e.id,
          name: e.name,
          designation: e.designation,
          status: e.sessions.length ? 'WORKING' : 'OFF_DUTY',
          lastPoint: p
            ? { latitude: Number(p.latitude), longitude: Number(p.longitude), capturedAt: p.capturedAt.toISOString() }
            : null,
        };
      }),
      recentUpdates: recent.map((u) => ({
        id: u.id, employeeId: u.employeeId, employeeName: u.employee.name,
        text: u.text, submittedAt: u.submittedAt.toISOString(),
      })),
      workHours,
    };
  }
}
```

`src/dashboard/dashboard.controller.ts`:
```ts
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentAuth, type AuthContext } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';

@Roles('OWNER', 'ADMIN')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext, @Query('date') date?: string) {
    return this.dashboard.get(auth.companyId, date);
  }
}
```

`src/dashboard/dashboard.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
```
Import `DashboardModule` in `app.module.ts`.

- [ ] **Step 6: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/api test`
Expected: PASS (all suites).

- [ ] **Step 7: Commit.**

```bash
git add apps/api
git commit -m "feat(api): GET /dashboard with IST-correct day bounds and session minute splitting"
```

---

### Task 9: Web app scaffold, theme and base UI components

**Files:**
- Create: `apps/web` via `create-next-app`, then `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/{button,input,field,segmented-tabs,card,logo}.tsx`, `src/lib/cn.ts`, `vitest.config.ts`, `test/setup.ts`
- Test: `apps/web/test/ui.test.tsx`

**Interfaces:**
- Consumes: `@worktrail/ui/theme.css`.
- Produces:
  - `Button({ variant: 'primary' | 'secondary' | 'ghost', trailingArrow?, loading?, ...button props })`
  - `Input({ icon?, ...input props })`
  - `Field({ label, error?, htmlFor, children })`
  - `SegmentedTabs({ options: {value,label,disabled?}[], value, onChange })`
  - `Card({ className?, children })`
  - `Logo({ size?: 'sm' | 'md' })`
  - `cn(...classes)`

- [ ] **Step 1: Scaffold.**

```bash
cd apps && pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack --skip-install && cd ..
pnpm --filter web pkg set name=@worktrail/web
pnpm --filter @worktrail/web add @worktrail/types@workspace:* @worktrail/ui@workspace:* react-hook-form @hookform/resolvers zod@^4 @tanstack/react-query lucide-react clsx tailwind-merge date-fns date-fns-tz maplibre-gl react-map-gl
pnpm --filter @worktrail/web add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths
```
Add these scripts to `apps/web/package.json`: `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`. Change `dev` to `next dev -p 3000`.

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], include: ['test/**/*.test.{ts,tsx}'] },
});
```

`apps/web/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing component tests.**

`apps/web/test/ui.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Logo } from '@/components/ui/logo';

describe('ui primitives', () => {
  it('primary button shows a spinner label and is disabled while loading', () => {
    render(<Button loading>Create account</Button>);
    const btn = screen.getByRole('button', { name: /create account/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('field links its error to the input for screen readers', () => {
    render(
      <Field label="Mobile number" htmlFor="phone" error="Enter a 10-digit mobile number">
        <Input id="phone" />
      </Field>,
    );
    const input = screen.getByLabelText('Mobile number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a 10-digit mobile number');
  });

  it('segmented tabs skip disabled options', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        value="email"
        onChange={onChange}
        options={[{ value: 'email', label: 'Email' }, { value: 'otp', label: 'Mobile OTP', disabled: true }]}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Mobile OTP' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true');
  });

  it('logo reads as one word pair', () => {
    render(<Logo />);
    expect(screen.getByLabelText('Work Trail')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/web test`
Expected: FAIL. `@/components/ui/button` not found.

- [ ] **Step 4: Implement.**

`src/app/globals.css` (replace the generated file):
```css
@import "tailwindcss";
@import "@worktrail/ui/theme.css";

@layer base {
  html { background: var(--color-canvas); color: var(--color-ink-700); }
  body { font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
  h1, h2, h3 { font-family: var(--font-display); color: var(--color-ink-900); font-weight: 700; }
  :focus-visible { outline: 2px solid var(--color-brand-500); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import './globals.css';

const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-barlow' });
const display = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi-condensed' });

export const metadata: Metadata = { title: 'Work Trail', description: 'Track work. Share updates. Get clear reports.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink-700">{children}</body>
    </html>
  );
}
```

`src/lib/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
```

`src/components/ui/button.tsx`:
```tsx
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  trailingArrow?: boolean;
  loading?: boolean;
};

const variants = {
  primary: 'bg-cta text-white shadow-[0_8px_20px_rgba(254,90,12,.28)] hover:brightness-95',
  secondary: 'bg-surface text-brand-600 border border-brand-200 hover:bg-brand-50',
  ghost: 'text-brand-700 hover:bg-brand-50',
};

export function Button({ variant = 'primary', trailingArrow, loading, disabled, className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-input px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      <span>{children}</span>
      {trailingArrow && !loading ? <ArrowRight className="size-5" aria-hidden /> : null}
    </button>
  );
}
```

`src/components/ui/field.tsx`:
```tsx
import { Children, cloneElement, isValidElement } from 'react';

type Props = { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactElement };

export function Field({ label, htmlFor, error, hint, children }: Props) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const child = Children.only(children);
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-900">{label}</label>
      {isValidElement<React.InputHTMLAttributes<HTMLInputElement>>(child)
        ? cloneElement(child, { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
        : child}
      {error ? <p id={`${htmlFor}-error`} className="text-sm text-danger-500">{error}</p> : null}
      {!error && hint ? <p id={`${htmlFor}-hint`} className="text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}
```

`src/components/ui/input.tsx`:
```tsx
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon; prefix?: string; trailing?: React.ReactNode };

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ icon: Icon, prefix, trailing, className, ...rest }, ref) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-input border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-brand-500 aria-[invalid=true]:border-danger-500">
      {Icon ? <Icon className="size-[18px] shrink-0 text-ink-300" aria-hidden /> : null}
      {prefix ? <span className="border-r border-line pr-2 text-sm font-medium text-ink-700">{prefix}</span> : null}
      <input
        ref={ref}
        {...rest}
        className={cn('h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-300', className)}
      />
      {trailing}
    </div>
  );
});
```

`src/components/ui/segmented-tabs.tsx`:
```tsx
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string; disabled?: boolean; title?: string };
type Props<T extends string> = { options: Option<T>[]; value: T; onChange: (v: T) => void };

export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div role="tablist" className="grid grid-flow-col gap-1 rounded-input border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          title={o.title}
          onClick={() => !o.disabled && onChange(o.value)}
          className={cn(
            'h-10 rounded-[9px] text-sm font-semibold transition',
            o.value === value ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-900',
            o.disabled && 'cursor-not-allowed opacity-50 hover:text-ink-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`src/components/ui/card.tsx`:
```tsx
import { cn } from '@/lib/cn';
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('rounded-card bg-surface shadow-card', className)} />;
}
```

`src/components/ui/logo.tsx`:
```tsx
import { cn } from '@/lib/cn';

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  const text = size === 'sm' ? 'text-xl' : 'text-[26px]';
  return (
    <span aria-label="Work Trail" className={cn('inline-flex items-center gap-1.5', className)}>
      <svg aria-hidden viewBox="0 0 24 32" className={size === 'sm' ? 'h-6' : 'h-8'}>
        <path d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z" fill="#FE5A0C" />
        <circle cx="12" cy="11" r="4" fill="#fff" />
        <path d="M4 30c4-3 12 1 16-2" stroke="#FE5A0C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      <span aria-hidden className={cn('font-display font-bold tracking-tight', text)}>
        <span className="text-ink-900">Work</span> <span className="text-brand-500">Trail</span>
      </span>
    </span>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck`
Expected: PASS (4 tests), no type errors.

- [ ] **Step 6: Commit.**

```bash
git add apps/web
git commit -m "feat(web): next app with Work Trail theme, fonts and base UI primitives"
```

---

### Task 10: Web session handling (route handlers, cookies, proxy refresh)

**Files:**
- Create: `apps/web/src/lib/session.ts`, `apps/web/src/lib/api-url.ts`, `apps/web/src/lib/server-api.ts`, `apps/web/src/app/api/session/[action]/route.ts`, `apps/web/src/proxy.ts`
- Test: `apps/web/test/session-route.test.ts`, `apps/web/test/proxy.test.ts`

**Interfaces:**
- Consumes: `AuthTokens`, `ApiErrorBody`, and the API endpoints from Task 6.
- Produces:
  - `POST /api/session/login | signup` (browser → Next). On success it returns `{ user }` and sets the `wt_at` and `wt_rt` httpOnly cookies. On failure it forwards the API status and error body.
  - `POST /api/session/logout` clears both cookies.
  - `serverApi<T>(path)` for Server Components. It redirects to `/login` on 401.
  - Proxy behaviour: `/app/**` requires a session and refreshes silently. `/login` and `/signup` redirect a signed-in user to `/app/dashboard`.
- Next.js note: Next 16 renamed `middleware.ts` to `proxy.ts`, which exports `proxy`. If `create-next-app` installed Next 15, name the file `src/middleware.ts` and export `middleware`. The body is the same either way.

- [ ] **Step 1: Write the failing tests.**

`apps/web/test/session-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/session/[action]/route';

const tokens = {
  accessToken: 'at.jwt', refreshToken: '11111111-1111-1111-1111-111111111111.secret',
  user: { id: 'u1', role: 'OWNER', companyId: 'c1', name: 'Rahul', email: 'r@a.in' },
};

const call = (action: string, body: unknown) =>
  POST(new Request(`http://localhost/api/session/${action}`, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ action }),
  });

afterEach(() => vi.restoreAllMocks());

describe('session route', () => {
  it('login sets httpOnly cookies and hides tokens from the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(tokens));
    const res = await call('login', { email: 'r@a.in', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/auth\/login$/), expect.any(Object));
    expect(await res.json()).toEqual({ user: tokens.user });
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/wt_at=at\.jwt;.*HttpOnly/i);
    expect(cookies).toMatch(/wt_rt=11111111-1111-1111-1111-111111111111\.secret;.*HttpOnly/i);
  });

  it('signup forwards to /auth/signup/admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(tokens, { status: 201 }));
    await call('signup', {});
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/auth\/signup\/admin$/), expect.any(Object));
  });

  it('passes API errors through unchanged', async () => {
    const err = { error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Sign in instead.', details: {} } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(err, { status: 409 }));
    const res = await call('signup', {});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(err);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns a readable error when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await call('login', {});
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('API_UNREACHABLE');
  });

  it('unknown action is 404', async () => {
    expect((await call('nope', {})).status).toBe(404);
  });
});
```

`apps/web/test/proxy.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const req = (path: string, cookies: Record<string, string> = {}) => {
  const r = new NextRequest(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
};

afterEach(() => vi.restoreAllMocks());

describe('proxy', () => {
  it('sends anonymous users from /app to /login', async () => {
    const res = await proxy(req('/app/dashboard'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets a valid access cookie through', async () => {
    const res = await proxy(req('/app/dashboard', { wt_at: 'a' }));
    expect(res.headers.get('location')).toBeNull();
  });

  it('silently refreshes when only the refresh cookie remains', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ accessToken: 'new-at', refreshToken: 'new-rt', user: {} }),
    );
    const res = await proxy(req('/app/dashboard', { wt_rt: 'old-rt' }));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.getSetCookie().join('\n')).toMatch(/wt_at=new-at/);
    expect(res.headers.get('x-middleware-request-cookie') ?? res.headers.get('x-middleware-override-headers')).toBeTruthy();
  });

  it('clears cookies and redirects when refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: {} }, { status: 401 }));
    const res = await proxy(req('/app/dashboard', { wt_rt: 'revoked' }));
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.headers.getSetCookie().join('\n')).toMatch(/wt_rt=;/);
  });

  it('sends signed-in users away from /login', async () => {
    const res = await proxy(req('/login', { wt_at: 'a' }));
    expect(res.headers.get('location')).toBe('http://localhost:3000/app/dashboard');
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/web test`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement.**

`src/lib/api-url.ts`:
```ts
export const apiUrl = (path: string) => `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1${path}`;
```

`src/lib/session.ts`:
```ts
import type { NextResponse } from 'next/server';
import type { AuthTokens } from '@worktrail/types';

type ResponseCookies = NextResponse['cookies'];

export const ACCESS_COOKIE = 'wt_at';
export const REFRESH_COOKIE = 'wt_rt';
const ACCESS_TTL = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86_400;

const base = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };

export function setSessionCookies(jar: ResponseCookies, t: Pick<AuthTokens, 'accessToken' | 'refreshToken'>) {
  // Expire the access cookie 30s before the JWT so the proxy refreshes before the API would 401.
  jar.set(ACCESS_COOKIE, t.accessToken, { ...base, maxAge: Math.max(ACCESS_TTL - 30, 60) });
  jar.set(REFRESH_COOKIE, t.refreshToken, { ...base, maxAge: REFRESH_TTL });
}

export function clearSessionCookies(jar: ResponseCookies) {
  jar.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  jar.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}
```

`src/app/api/session/[action]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { AuthTokens } from '@worktrail/types';
import { apiUrl } from '@/lib/api-url';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/session';

const TARGETS: Record<string, string> = { login: '/auth/login', signup: '/auth/signup/admin' };

const unreachable = () =>
  NextResponse.json(
    { error: { code: 'API_UNREACHABLE', message: 'Work Trail is not reachable right now. Check your connection and try again.', details: {} } },
    { status: 503 },
  );

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;

  if (action === 'logout') {
    const rt = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (rt) {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => undefined);
    }
    const res = NextResponse.json({ ok: true });
    clearSessionCookies(res.cookies);
    return res;
  }

  const target = TARGETS[action];
  if (!target) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.', details: {} } }, { status: 404 });

  let apiRes: Response;
  try {
    apiRes = await fetch(apiUrl(target), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: await req.text(),
    });
  } catch {
    return unreachable();
  }
  const body = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !body) return NextResponse.json(body, { status: apiRes.status });

  const tokens = body as AuthTokens;
  const res = NextResponse.json({ user: tokens.user });
  setSessionCookies(res.cookies, tokens);
  return res;
}
```
Under Vitest, `cookies()` is only reached on the logout path, and no test exercises logout. Next's own end-to-end flow covers it in Task 11, Step 6.

`src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import type { AuthTokens } from '@worktrail/types';
import { apiUrl } from '@/lib/api-url';
import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/session';

const AUTH_PAGES = new Set(['/login', '/signup']);

async function refresh(rt: string): Promise<AuthTokens | null> {
  try {
    const r = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
    });
    return r.ok ? ((await r.json()) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;

  if (AUTH_PAGES.has(req.nextUrl.pathname)) {
    return at ? NextResponse.redirect(new URL('/app/dashboard', req.url)) : NextResponse.next();
  }
  if (at) return NextResponse.next();

  const toLogin = () => {
    const res = NextResponse.redirect(new URL('/login', req.url));
    clearSessionCookies(res.cookies);
    return res;
  };
  if (!rt) return NextResponse.redirect(new URL('/login', req.url));

  const tokens = await refresh(rt);
  if (!tokens) return toLogin();

  // Forward the new cookies to this request too, so Server Components see them immediately.
  req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const res = NextResponse.next({ request: { headers: req.headers } });
  setSessionCookies(res.cookies, tokens);
  return res;
}

export const config = { matcher: ['/app/:path*', '/login', '/signup'] };
```

`src/lib/server-api.ts`:
```ts
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApiErrorBody } from '@worktrail/types';
import { apiUrl } from './api-url';
import { ACCESS_COOKIE } from './session';

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody | null) {
    super(body?.error.message ?? `API ${status}`);
  }
}

export async function serverApi<T>(path: string): Promise<T> {
  const at = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!at) redirect('/login');
  const res = await fetch(apiUrl(path), { headers: { authorization: `Bearer ${at}` }, cache: 'no-store' });
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}
```
Add the dependency: `pnpm --filter @worktrail/web add server-only`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/web test`
Expected: PASS. The proxy's "silently refreshes" test asserts that Next sets an override header. If your Next version names it differently, print `[...res.headers.keys()]` once and update the assertion to that header name. Don't remove the assertion.

- [ ] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat(web): httpOnly cookie session via route handlers and proxy silent refresh"
```

---

### Task 11: Auth screens (sign-up and login) matching the mockup

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx`, `apps/web/src/app/(auth)/signup/page.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/components/auth/auth-panel.tsx`, `apps/web/src/components/auth/signup-form.tsx`, `apps/web/src/components/auth/login-form.tsx`, `apps/web/src/components/auth/submit-json.ts`, `apps/web/public/illustrations/auth-signup.png`, `apps/web/public/illustrations/auth-login.png`
- Test: `apps/web/test/auth-forms.test.tsx`

**Interfaces:**
- Consumes: `AdminSignupSchema`, `LoginSchema`, `normalizeIndianMobile` from `@worktrail/types`. `Button`, `Field`, `Input`, `SegmentedTabs`, `Logo`. `POST /api/session/{signup,login}`.
- Produces:
  - `/signup` and `/login` pages. Both redirect to `/app/dashboard` on success via `router.replace`.
  - `submitJson(url, body) → { ok: true; data } | { ok: false; message; fields }`

- [ ] **Step 1: Add the illustrations.** Until final artwork arrives (see Open Questions), crop the two left-panel illustrations from `docs/specs/First 3 screens.png`:

```bash
cd apps/web && python - <<'PY'
from PIL import Image
im = Image.open('../../docs/specs/First 3 screens.png')
im.crop((24, 430, 238, 700)).resize((428, 540)).save('public/illustrations/auth-signup.png')
im.crop((527, 470, 732, 790)).resize((410, 640)).save('public/illustrations/auth-login.png')
PY
cd ../..
```

- [ ] **Step 2: Write the failing form tests.**

`apps/web/test/auth-forms.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { SignupForm } from '@/components/auth/signup-form';
import { LoginForm } from '@/components/auth/login-form';

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

async function fillSignup(phone: string) {
  await userEvent.type(screen.getByLabelText('Company name'), 'Acme Services');
  await userEvent.type(screen.getByLabelText('Your name'), 'Rahul Sharma');
  await userEvent.type(screen.getByLabelText('Email address'), 'rahul@acme.in');
  await userEvent.type(screen.getByLabelText('Mobile number'), phone);
  await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1');
}

describe('SignupForm', () => {
  it('shows a phone error without calling the server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<SignupForm />);
    await fillSignup('12345');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a normalised +91 number and goes to the dashboard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ user: {} }));
    render(<SignupForm />);
    await fillSignup('98765 43210');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.phone).toBe('+919876543210');
    expect(replace).toHaveBeenCalledWith('/app/dashboard');
  });

  it('puts a server field error next to the field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Sign in instead.', details: {} } }, { status: 409 }),
    );
    render(<SignupForm />);
    await fillSignup('9876543210');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists. Sign in instead.');
  });
});

describe('LoginForm', () => {
  it('shows the server message on bad credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.', details: {} } }, { status: 401 }),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'r@a.in');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    render(<LoginForm />);
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');
  });
});
```

- [ ] **Step 3: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/web test -- auth-forms`
Expected: FAIL. Modules not found.

- [ ] **Step 4: Implement.**

`src/components/auth/submit-json.ts`:
```ts
import type { ApiErrorBody } from '@worktrail/types';

export type SubmitResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string> };

export async function submitJson<T>(url: string, body: unknown): Promise<SubmitResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const err = (json as ApiErrorBody | null)?.error;
    return {
      ok: false,
      message: err?.message ?? 'Something went wrong. Try again.',
      fields: (err?.details?.fields as Record<string, string> | undefined) ?? {},
    };
  } catch {
    return { ok: false, message: 'You appear to be offline. Check your connection and try again.', fields: {} };
  }
}
```

`src/components/auth/signup-form.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff, Lock, Mail, Smartphone, User } from 'lucide-react';
import { AdminSignupSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { submitJson } from './submit-json';

type FormIn = z.input<typeof AdminSignupSchema>;
type FormOut = z.output<typeof AdminSignupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(AdminSignupSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const r = await submitJson('/api/session/signup', values);
    if (r.ok) return router.replace('/app/dashboard');
    for (const [name, message] of Object.entries(r.fields)) setError(name as keyof FormIn, { message });
    if (!Object.keys(r.fields).length) setFormError(r.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message}>
        <Input id="companyName" icon={Building2} placeholder="Enter company name" autoComplete="organization" {...register('companyName')} />
      </Field>
      <Field label="Your name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" icon={User} placeholder="Enter your name" autoComplete="name" {...register('name')} />
      </Field>
      <Field label="Email address" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" icon={Mail} placeholder="you@company.com" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" type="tel" inputMode="tel" icon={Smartphone} prefix="+91" placeholder="Enter mobile number" autoComplete="tel-national" {...register('phone')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters">
        <Input
          id="password"
          type={showPw ? 'text' : 'password'}
          icon={Lock}
          placeholder="Create a password"
          autoComplete="new-password"
          {...register('password')}
          trailing={
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="text-ink-500">
              {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          }
        />
      </Field>
      {formError ? <p role="alert" className="rounded-input bg-brand-50 px-3 py-2 text-sm text-ink-900">{formError}</p> : null}
      <Button type="submit" trailingArrow loading={isSubmitting} className="mt-2">Create account</Button>
      <p className="text-center text-xs text-ink-500">
        By creating an account, you agree to our <a href="/terms" className="font-medium text-brand-700">Terms of Service</a> and{' '}
        <a href="/privacy" className="font-medium text-brand-700">Privacy Policy</a>.
      </p>
    </form>
  );
}
```
The tests expect the server error in `role="alert"` when the API returns no field errors (`EMAIL_TAKEN`). The code above does exactly that. Copy note: the button says "Create account" in sentence case, so the button and the page title use the same verb.

`src/components/auth/login-form.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { LoginSchema, type LoginInput } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { submitJson } from './submit-json';

export function LoginForm() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const r = await submitJson('/api/session/login', { ...values, remember });
    if (r.ok) return router.replace('/app/dashboard');
    setFormError(r.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <SegmentedTabs
        value="email"
        onChange={() => undefined}
        options={[
          { value: 'email', label: 'Email' },
          { value: 'otp', label: 'Mobile OTP', disabled: true, title: 'Mobile OTP sign-in is coming after launch' },
        ]}
      />
      <Field label="Email address" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" icon={Mail} placeholder="you@company.com" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type={showPw ? 'text' : 'password'}
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
          {...register('password')}
          trailing={
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="text-ink-500">
              {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          }
        />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-ink-700">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-brand-500" />
          Remember me
        </label>
        <a href="/forgot-password" className="font-medium text-brand-700">Forgot password?</a>
      </div>
      {formError ? <p role="alert" className="rounded-input bg-brand-50 px-3 py-2 text-sm text-ink-900">{formError}</p> : null}
      <Button type="submit" trailingArrow loading={isSubmitting}>Sign in</Button>
    </form>
  );
}
```
"Remember me" is sent but ignored for now. In Task 10 the refresh cookie always lasts 30 days. Making unticked "Remember me" issue a session-only refresh cookie belongs to the password-reset work in Phase 1b. That's listed in Open Questions, so the checkbox isn't a silent no-op.

`src/components/auth/auth-panel.tsx`:
```tsx
import Image from 'next/image';
import { BarChart3, MapPin, MessageSquareText } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

const FEATURES = [
  { icon: MapPin, title: 'Track field teams', body: 'Know where your team works' },
  { icon: MessageSquareText, title: 'Get real updates', body: 'Text or voice updates from the field' },
  { icon: BarChart3, title: 'Clear reports', body: 'Daily, weekly and monthly PDFs' },
];

type Props = { variant: 'signup' | 'login' };

export function AuthPanel({ variant }: Props) {
  const signup = variant === 'signup';
  return (
    <aside className="relative flex flex-col overflow-hidden bg-auth-panel p-8 max-[900px]:h-40 max-[900px]:p-6">
      <Logo />
      <div className="mt-14 max-[900px]:hidden">
        <h1 className="text-[40px] leading-[1.1]">
          {signup ? (<>Track work.<br />Get real<br /><span className="text-brand-500">visibility.</span></>) : (<>Welcome<br /><span className="text-brand-500">back!</span></>)}
        </h1>
        <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-ink-700">
          {signup
            ? 'Manage your field team, track work sessions, view locations and get clear reports, all in one place.'
            : 'Sign in to manage your team, track work and generate reports.'}
        </p>
      </div>
      <Image
        src={signup ? '/illustrations/auth-signup.png' : '/illustrations/auth-login.png'}
        alt=""
        width={428}
        height={signup ? 540 : 640}
        priority
        className="mt-auto w-full object-contain max-[900px]:hidden"
      />
      {signup ? (
        <ul className="absolute inset-x-6 bottom-6 space-y-3 max-[900px]:hidden">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-center gap-3 rounded-input bg-surface/95 p-3 shadow-card">
              <span className="grid size-10 place-items-center rounded-[10px] bg-brand-500 text-white"><Icon className="size-5" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">{title}</span>
                <span className="block text-xs text-ink-500">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
```

`src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4 sm:p-8">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-panel bg-surface shadow-card min-[900px]:grid-cols-[42fr_58fr]">
        {children}
      </div>
    </main>
  );
}
```

`src/app/(auth)/signup/page.tsx`:
```tsx
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata = { title: 'Create company account · Work Trail' };

export default function SignupPage() {
  return (
    <>
      <AuthPanel variant="signup" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          Already have an account? <Link href="/login" className="font-semibold text-brand-700">Sign in</Link>
        </p>
        <div className="mx-auto mt-8 max-w-[400px]">
          <h2 className="text-[32px] leading-[1.15]">Create company account</h2>
          <p className="mb-8 mt-1 text-ink-500">Get started with Work Trail</p>
          <SignupForm />
        </div>
      </section>
    </>
  );
}
```

`src/app/(auth)/login/page.tsx`:
```tsx
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in · Work Trail' };

export default function LoginPage() {
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          New to Work Trail? <Link href="/signup" className="font-semibold text-brand-700">Create company account</Link>
        </p>
        <div className="mx-auto mt-16 max-w-[400px]">
          <h2 className="text-[32px] leading-[1.15]">Sign in</h2>
          <p className="mb-8 mt-1 text-ink-500">Welcome back to Work Trail</p>
          <LoginForm />
        </div>
      </section>
    </>
  );
}
```
The mockup puts the "Sign in" link (signup page) and "Sign up" link (login page) top-right. The "Sign in with Google" button is left out until it's decided (Open Questions #3).

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck`
Expected: PASS.

- [ ] **Step 6: Check the flow end to end in the browser and compare with the mockup.**

Run `pnpm dev` (API on :4000, web on :3000). Then:
1. Open `http://localhost:3000/signup`. Screenshot it at 1440×900 and at 390×844, and place it next to panel 1 of `docs/specs/First 3 screens.png`. Check: logo colours, 40px headline with "visibility." in orange, field order (Company name, Your name, Email address, Mobile number +91, Password), gradient button with arrow, and the terms line. On mobile the illustration panel collapses to the header band.
2. Create an account. You land on `/app/dashboard` (a 404 until Task 12; the redirect is what counts here).
3. Open `/login` while signed in. Expected: redirect to `/app/dashboard`.
4. Delete the `wt_at` cookie in devtools and reload `/app/dashboard`. Expected: no redirect, and a new `wt_at` is set.
5. Tab through the form. Every control shows the orange focus ring.

- [ ] **Step 7: Commit.**

```bash
git add apps/web
git commit -m "feat(web): admin sign-up and sign-in screens matching mockup"
```

---

### Task 12: App shell and the admin dashboard

**Files:**
- Create: `apps/web/src/lib/format.ts`, `apps/web/src/app/app/layout.tsx`, `apps/web/src/app/app/dashboard/page.tsx`, `apps/web/src/components/shell/sidebar.tsx`, `apps/web/src/components/shell/topbar.tsx`, `apps/web/src/components/dashboard/{kpi-card,date-picker,locations-card,locations-map,recent-updates,work-hours,avatar}.tsx`
- Test: `apps/web/test/format.test.ts`, `apps/web/test/dashboard.test.tsx`

**Interfaces:**
- Consumes: `DashboardResponse`, `serverApi`, `AuthUser`, `Card`, `Logo`.
- Produces:
  - `formatMinutes(m): string` ("6h 24m", "45m")
  - `formatHours(m): string` ("86h", "0h")
  - `percentChange(today, yesterday): number | null`
  - `greeting(date, tz): 'Good morning' | 'Good afternoon' | 'Good evening'`
  - `initials(name): string`
  - The `/app/dashboard?date=YYYY-MM-DD` page.

- [ ] **Step 1: Write the failing tests.**

`apps/web/test/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatHours, formatMinutes, greeting, initials, percentChange } from '@/lib/format';

describe('format', () => {
  it('formatMinutes', () => {
    expect(formatMinutes(384)).toBe('6h 24m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(0)).toBe('0m');
  });
  it('formatHours rounds down to whole hours', () => {
    expect(formatHours(5190)).toBe('86h');
    expect(formatHours(59)).toBe('0h');
  });
  it('percentChange is null when there is no baseline', () => {
    expect(percentChange(12, 0)).toBeNull();
    expect(percentChange(24, 20)).toBe(20);
    expect(percentChange(15, 20)).toBe(-25);
  });
  it('greeting follows the company timezone', () => {
    expect(greeting(new Date('2026-10-04T02:00:00Z'), 'Asia/Kolkata')).toBe('Good morning'); // 07:30 IST
    expect(greeting(new Date('2026-10-04T08:00:00Z'), 'Asia/Kolkata')).toBe('Good afternoon'); // 13:30 IST
    expect(greeting(new Date('2026-10-04T13:00:00Z'), 'Asia/Kolkata')).toBe('Good evening'); // 18:30 IST
  });
  it('initials', () => {
    expect(initials('Rahul Sharma')).toBe('RS');
    expect(initials('neha')).toBe('NE');
  });
});
```

`apps/web/test/dashboard.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '@worktrail/types';

vi.mock('@/components/dashboard/locations-map', () => ({ LocationsMap: () => <div data-testid="map" /> }));

import { KpiRow } from '@/components/dashboard/kpi-card';
import { RecentUpdates } from '@/components/dashboard/recent-updates';
import { WorkHours } from '@/components/dashboard/work-hours';
import { LocationsCard } from '@/components/dashboard/locations-card';

const data: DashboardResponse = {
  date: '2026-10-04', timezone: 'Asia/Kolkata',
  kpis: { totalEmployees: 28, workingNow: 12, checkedInToday: 15, workMinutesToday: 5190, workMinutesYesterday: 4800, updatesToday: 24, updatesYesterday: 20 },
  locations: [
    { employeeId: 'a', name: 'Amit Kumar', designation: 'Field Sales', status: 'WORKING', lastPoint: { latitude: 19.07, longitude: 72.87, capturedAt: '2026-10-04T04:54:00Z' } },
    { employeeId: 'b', name: 'Neha Patel', designation: null, status: 'OFF_DUTY', lastPoint: null },
  ],
  recentUpdates: [{ id: 'u', employeeId: 'a', employeeName: 'Amit Kumar', text: 'Completed site visit.', submittedAt: '2026-10-04T04:48:00Z' }],
  workHours: [{ employeeId: 'a', name: 'Amit Kumar', minutes: 384 }, { employeeId: 'c', name: 'Rohit Singh', minutes: 192 }],
};

describe('dashboard sections', () => {
  it('KPIs show values and only meaningful trends', () => {
    render(<KpiRow kpis={data.kpis} />);
    const hours = screen.getByRole('group', { name: 'Total work hours' });
    expect(within(hours).getByText('86h')).toBeInTheDocument();
    expect(within(hours).getByText('8% vs yesterday')).toBeInTheDocument();
    const working = screen.getByRole('group', { name: 'Working now' });
    expect(within(working).getByText('12')).toBeInTheDocument();
    expect(within(working).getByText('15 checked in today')).toBeInTheDocument();
  });

  it('recent updates show name, IST time and text', () => {
    render(<RecentUpdates items={data.recentUpdates} timezone="Asia/Kolkata" />);
    expect(screen.getByText('Amit Kumar')).toBeInTheDocument();
    expect(screen.getByText('10:18 AM')).toBeInTheDocument();
    expect(screen.getByText('Completed site visit.')).toBeInTheDocument();
  });

  it('work hours bars are relative to the longest day', () => {
    render(<WorkHours items={data.workHours} />);
    expect(screen.getByRole('progressbar', { name: 'Amit Kumar' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar', { name: 'Rohit Singh' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('6h 24m')).toBeInTheDocument();
  });

  it('locations card lists people with their last point and never says live', () => {
    render(<LocationsCard locations={data.locations} timezone="Asia/Kolkata" />);
    expect(screen.getByText('Last known locations')).toBeInTheDocument();
    expect(screen.getByText('Working · 10:24 AM')).toBeInTheDocument();
    expect(screen.getByText('No location yet')).toBeInTheDocument();
    expect(screen.queryByText(/live/i)).toBeNull();
  });

  it('empty states invite action', () => {
    render(<RecentUpdates items={[]} timezone="Asia/Kolkata" />);
    expect(screen.getByText('No updates yet today. Updates appear here as soon as your team submits them.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `pnpm --filter @worktrail/web test`
Expected: FAIL. Modules not found.

- [ ] **Step 3: Implement the helpers.**

`src/lib/format.ts`:
```ts
import { formatInTimeZone } from 'date-fns-tz';

export function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}
export const formatHours = (m: number) => `${Math.floor(m / 60)}h`;

export function percentChange(today: number, yesterday: number) {
  if (yesterday === 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

export function greeting(now: Date, tz: string) {
  const h = Number(formatInTimeZone(now, tz, 'H'));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase();
}

export const timeIn = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'h:mm a');
```

- [ ] **Step 4: Implement the dashboard components.**

`src/components/dashboard/avatar.tsx`:
```tsx
import { initials } from '@/lib/format';
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
      {initials(name)}
    </span>
  );
}
```

`src/components/dashboard/kpi-card.tsx`:
```tsx
import { Clock, FileText, MapPin, Users } from 'lucide-react';
import type { DashboardResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { formatHours, percentChange } from '@/lib/format';

type Kpis = DashboardResponse['kpis'];

function Trend({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={up ? 'text-success-500' : 'text-ink-500'}>
      {up ? '↑' : '↓'} <span>{Math.abs(value)}% vs yesterday</span>
    </span>
  );
}

function Kpi({ label, icon: Icon, value, foot }: { label: string; icon: typeof Users; value: string; foot: React.ReactNode }) {
  return (
    <Card role="group" aria-label={label} className="p-5">
      <span className="grid size-10 place-items-center rounded-[10px] bg-brand-50 text-brand-500"><Icon className="size-5" aria-hidden /></span>
      <p className="mt-4 font-display text-[32px] font-bold leading-none text-ink-900">{value}</p>
      <p className="mt-1 text-sm text-ink-500">{label}</p>
      <p className="mt-3 text-xs font-medium">{foot}</p>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Kpi label="Total employees" icon={Users} value={String(kpis.totalEmployees)} foot={<span className="text-ink-500">In your company</span>} />
      <Kpi
        label="Working now"
        icon={MapPin}
        value={String(kpis.workingNow)}
        foot={<span className="inline-flex items-center gap-1.5 text-ink-500"><span className="size-2 rounded-full bg-success-500" aria-hidden />{kpis.checkedInToday} checked in today</span>}
      />
      <Kpi label="Total work hours" icon={Clock} value={formatHours(kpis.workMinutesToday)} foot={<Trend value={percentChange(kpis.workMinutesToday, kpis.workMinutesYesterday)} />} />
      <Kpi label="Updates today" icon={FileText} value={String(kpis.updatesToday)} foot={<Trend value={percentChange(kpis.updatesToday, kpis.updatesYesterday)} />} />
    </div>
  );
}
```
The test looks for the text `8% vs yesterday` (5190 vs 4800 is +8%). The arrow sits in a separate text node, so `getByText` matches the inner span.

`src/components/dashboard/recent-updates.tsx`:
```tsx
import type { DashboardResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { timeIn } from '@/lib/format';
import { Avatar } from './avatar';

export function RecentUpdates({ items, timezone }: { items: DashboardResponse['recentUpdates']; timezone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg">Recent updates</h3>
        <a href="/app/employees" className="text-sm font-semibold text-brand-700">View all</a>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No updates yet today. Updates appear here as soon as your team submits them.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((u) => (
            <li key={u.id} className="flex gap-3 py-3">
              <Avatar name={u.employeeName} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">{u.employeeName}</p>
                <p className="text-xs text-ink-500">{timeIn(u.submittedAt, timezone)}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-700">{u.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

`src/components/dashboard/work-hours.tsx`:
```tsx
import type { DashboardResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { formatMinutes } from '@/lib/format';
import { Avatar } from './avatar';

export function WorkHours({ items }: { items: DashboardResponse['workHours'] }) {
  const max = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg">Today&apos;s work hours</h3>
        <a href="/app/sessions" className="text-sm font-semibold text-brand-700">View details</a>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No one has started work today. Hours appear once a session starts.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.slice(0, 6).map((w) => {
            const pct = Math.round((w.minutes / max) * 100);
            return (
              <li key={w.employeeId} className="flex items-center gap-3">
                <Avatar name={w.name} size={32} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ink-900">{w.name}</span>
                    <span className="text-ink-500">{formatMinutes(w.minutes)}</span>
                  </div>
                  <div role="progressbar" aria-label={w.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-1.5 rounded-full bg-brand-50">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
```

`src/components/dashboard/locations-map.tsx`:
```tsx
'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import { useEffect, useRef } from 'react';
import type { DashboardResponse } from '@worktrail/types';

const STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
type Loc = DashboardResponse['locations'][number];

export function LocationsMap({ locations }: { locations: Loc[] }) {
  const ref = useRef<MapRef>(null);
  const pts = locations.filter((l) => l.lastPoint);

  useEffect(() => {
    const map = ref.current;
    if (!map || pts.length === 0) return;
    const lats = pts.map((p) => p.lastPoint!.latitude);
    const lngs = pts.map((p) => p.lastPoint!.longitude);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 14, duration: 0 });
  }, [pts]);

  const first = pts[0]?.lastPoint;
  return (
    <Map
      ref={ref}
      mapStyle={STYLE}
      initialViewState={{ latitude: first?.latitude ?? 19.076, longitude: first?.longitude ?? 72.8777, zoom: 10 }}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      attributionControl={{ compact: true }}
    >
      {pts.map((l) => (
        <Marker key={l.employeeId} latitude={l.lastPoint!.latitude} longitude={l.lastPoint!.longitude} anchor="bottom">
          <svg width="28" height="36" viewBox="0 0 24 32" aria-label={l.name} role="img">
            <path d="M12 1C6.5 1 2 5.4 2 10.9 2 18 12 27 12 27s10-9 10-16.1C22 5.4 17.5 1 12 1Z" fill={l.status === 'WORKING' ? '#FE5A0C' : '#A9ACB0'} stroke="#fff" strokeWidth="1.5" />
            <circle cx="12" cy="11" r="4" fill="#fff" />
          </svg>
        </Marker>
      ))}
    </Map>
  );
}
```

`src/components/dashboard/locations-card.tsx`:
```tsx
import dynamic from 'next/dynamic';
import type { DashboardResponse } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { timeIn } from '@/lib/format';
import { Avatar } from './avatar';

const LocationsMap = dynamic(() => import('./locations-map').then((m) => m.LocationsMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-input bg-brand-50" />,
});

export function LocationsCard({ locations, timezone }: { locations: DashboardResponse['locations']; timezone: string }) {
  const working = locations.filter((l) => l.status === 'WORKING').length;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg">Last known locations</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-500">
          <span className="size-2 rounded-full bg-success-500" aria-hidden />{working} working now
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="h-[280px]"><LocationsMap locations={locations} /></div>
        <ul className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
          {locations.map((l) => (
            <li key={l.employeeId} className="flex items-center gap-3">
              <Avatar name={l.name} size={32} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{l.name}</p>
                <p className="text-xs text-ink-500">
                  {l.lastPoint ? `${l.status === 'WORKING' ? 'Working' : 'Off duty'} · ${timeIn(l.lastPoint.capturedAt, timezone)}` : 'No location yet'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
```

`src/components/dashboard/date-picker.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';

export function DatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-input border border-line bg-surface px-3 text-sm text-ink-700">
      <span className="sr-only">Show dashboard for date</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && router.replace(`/app/dashboard?date=${e.target.value}`)}
        className="bg-transparent outline-none"
      />
    </label>
  );
}
```

- [ ] **Step 5: Implement the shell and the page.**

`src/components/shell/sidebar.tsx`:
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, FileBarChart, LayoutDashboard, Settings, Users } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/employees', label: 'Employees', icon: Users },
  { href: '/app/sessions', label: 'Work sessions', icon: Clock },
  { href: '/app/reports', label: 'Reports', icon: FileBarChart },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-5 max-lg:hidden">
      <Logo size="sm" className="mb-6 px-3" />
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex h-11 items-center gap-3 rounded-input px-3 text-sm font-medium', active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-900')}
          >
            <Icon className="size-[18px]" aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`src/components/shell/topbar.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { Bell, LogOut } from 'lucide-react';
import type { AuthUser } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', EMPLOYEE: 'Employee' } as const;

export function Topbar({ user }: { user: AuthUser }) {
  const router = useRouter();
  const signOut = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/login');
  };
  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-line bg-surface px-6">
      <button type="button" aria-label="Notifications" className="grid size-10 place-items-center rounded-full text-ink-500 hover:bg-brand-50">
        <Bell className="size-5" />
      </button>
      <div className="flex items-center gap-3">
        <Avatar name={user.name} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="text-xs text-ink-500">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <button type="button" onClick={signOut} aria-label="Sign out" className="grid size-10 place-items-center rounded-full text-ink-500 hover:bg-brand-50">
        <LogOut className="size-5" />
      </button>
    </header>
  );
}
```
The notifications bell has no feature behind it in the MVP. Leave it out unless Open Question #6 says to keep it. If it's dropped, delete the button.

`src/app/app/layout.tsx`:
```tsx
import type { AuthUser } from '@worktrail/types';
import { serverApi } from '@/lib/server-api';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await serverApi<AuthUser>('/auth/me');
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
```

`src/app/app/dashboard/page.tsx`:
```tsx
import type { AuthUser, DashboardResponse } from '@worktrail/types';
import { serverApi } from '@/lib/server-api';
import { greeting } from '@/lib/format';
import { KpiRow } from '@/components/dashboard/kpi-card';
import { LocationsCard } from '@/components/dashboard/locations-card';
import { RecentUpdates } from '@/components/dashboard/recent-updates';
import { WorkHours } from '@/components/dashboard/work-hours';
import { DatePicker } from '@/components/dashboard/date-picker';
import { formatInTimeZone } from 'date-fns-tz';

export const metadata = { title: 'Dashboard · Work Trail' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const qs = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `?date=${date}` : '';
  const [user, data] = await Promise.all([
    serverApi<AuthUser>('/auth/me'),
    serverApi<DashboardResponse>(`/dashboard${qs}`),
  ]);
  const today = formatInTimeZone(new Date(), data.timezone, 'yyyy-MM-dd');
  const firstName = user.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight">{greeting(new Date(), data.timezone)}, {firstName}</h1>
          <p className="text-ink-500">Here&apos;s an overview of your field team {data.date === today ? 'today' : `on ${data.date}`}.</p>
        </div>
        <DatePicker value={data.date} max={today} />
      </div>
      <KpiRow kpis={data.kpis} />
      <LocationsCard locations={data.locations} timezone={data.timezone} />
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentUpdates items={data.recentUpdates} timezone={data.timezone} />
        <WorkHours items={data.workHours} />
      </div>
    </div>
  );
}
```
`/auth/me` is requested twice (layout and page). Next de-duplicates identical `fetch` calls only when caching is on, and here it's `no-store`. Accept the extra request in Phase 1. Moving the user into a React `cache()` wrapper is a two-line follow-up if it shows in traces.

- [ ] **Step 6: Run the tests to verify they pass.**

Run: `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck`
Expected: PASS.

- [ ] **Step 7: Check with seeded data and compare with the mockup.**

Run: `pnpm --filter @worktrail/api db:seed && pnpm dev`. Sign in as `admin@demo.worktrail.in` with `SEED_ADMIN_PASSWORD`.
1. Take a screenshot at 1440×900 and place it next to panel 3 of `First 3 screens.png`. Check:
   - Sidebar with the active orange pill.
   - Greeting and date picker on the right.
   - Four KPI cards with orange icon wells.
   - The map card with orange pins around Mumbai and the people list on the right.
   - "Recent updates" and "Today's work hours" side by side, with orange bars.
2. Pick yesterday's date. The KPIs change and the subtitle reads "on YYYY-MM-DD".
3. At 1024px wide the sidebar hides and the cards still read cleanly. At 390px the KPIs sit in two columns.
4. Stop the API and reload. Expected: Next's error page. Adding `app/app/error.tsx` with "Work Trail is not reachable right now. Try again in a moment." and a Retry button is part of this task:

`src/app/app/error.tsx`:
```tsx
'use client';
import { Button } from '@/components/ui/button';

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-2xl">Work Trail is not reachable right now</h1>
      <p className="mt-2 text-ink-500">Your data is safe. Check your connection and try again.</p>
      <Button className="mx-auto mt-6 max-w-[200px]" onClick={reset}>Try again</Button>
    </div>
  );
}
```

- [ ] **Step 8: Commit.**

```bash
git add apps/web
git commit -m "feat(web): app shell and admin dashboard on seeded data"
```

---

## Phases 1b–7: milestone outlines (each gets its own detailed plan before work starts)

**Phase 1b: invitations and account recovery**
- API: `POST /employees/invitations` (hashed single-use token, 7-day expiry, audit log entry) and `POST /employees/invitations/:token/accept`.
- Forgot/reset password using emailed tokens. "Remember me" off issues a browser-session refresh cookie.
- Web: `/app/employees` list with search, status filter and pagination; `/app/employees/new` invite form with a "Copy link" and "Share on WhatsApp" deep link; `/forgot-password`.
- Done when: an admin invites Ravi, Ravi sets a password from the link, and Ravi appears on the dashboard.

**Phase 2: employee app and work sessions**
- `apps/mobile`: an Expo development build with Expo Router, Zustand and TanStack Query, styled from `@worktrail/ui` tokens.
- Screens: welcome (`Landing page.png`), login, invite acceptance, permission disclosure, home (off duty), active session (timer and last sync), profile.
- API: `POST /sessions/start` and `POST /sessions/:id/end` (each captures one location), `GET /sessions/me/active`. If an active session already exists, it's restored or ended on launch.
- Done when: start and end create correct records and a second concurrent start is refused.

**Phase 3: location pipeline**
- Background task every 5 minutes with an Android foreground notification.
- SQLite outbox with `clientPointId`, retry/backoff and an `Idempotency-Key`.
- `POST /locations/batch` checks session ownership and coordinates and sets quality flags.
- A physical-device test checklist covering screen lock, battery saver, no network and reconnect.

**Phase 4: updates and voice**
- Add Update screen: 5–2,000 characters, an optional category, and `expo-speech-recognition` writing into the same editable field.
- Offline queue. `POST /updates` returns `summaryStatus: QUEUED`. Own update history.

**Phase 5: admin employee detail**
- `/app/employees/[id]` with Overview, Map, Updates, Work hours and Reports tabs.
- Date presets: Today, Yesterday, This week, Last week, This month, Custom.
- Route line with start and end markers, accuracy warnings and data-gap segments. `/app/sessions` page.

**Phase 6: AI summaries and PDF**
- BullMQ worker for per-update summaries and daily/weekly/monthly reports, using the prompts and JSON schemas in `ai-prompts.pdf`. One repair retry, then FAILED.
- `POST /reports` and `GET /reports/:id/download` (server HTML to PDF with Playwright, private storage).
- The AI label appears on every generated output.

**Phase 7: hardening and pilot**
- Audit events, Sentry, backups, a retention job (default 90 days for precise location), consent records, data export/delete, a multi-brand Android test matrix and a five-company pilot.

---

## Open Questions (each has a default in the plan; tell me if any is wrong)

1. **Palette:** your mockups (orange on warm white) replace `build-prompt.pdf`'s teal palette everywhere, including the employee app. *Default: yes, as you said.*
2. **Typeface:** the mockup headings look like a narrow, heavy grotesque, so I matched them with Barlow Semi Condensed and Barlow. Do you know the exact font used in the mockups, or is this pairing fine? *Default: Barlow.*
3. **"Mobile OTP" tab and "Sign in with Google":** the PRD says OTP comes after the MVP and doesn't mention Google. *Default: the OTP tab is shown disabled with a "coming after launch" tooltip, and the Google button is left out.* Keep, hide, or build them?
4. **"Live Locations" heading:** the PRD forbids claiming real-time tracking (points arrive every ~5 minutes). *Default: renamed to "Last known locations", with a "12 working now" chip instead of "Live".*
5. **KPIs:** the PRD lists five (total, working now, checked in today, hours today, updates today). The mockup shows four. *Default: the mockup's four cards, with "checked in today" as the footnote under "Working now".*
6. **Notification bell:** there's no notifications feature in the MVP. *Default: drop it, so it doesn't promise something that doesn't exist.* Keep it as decoration, or drop it?
7. **Illustrations:** the 3D city, route and person artwork. Do you have the original images (PNG/SVG), or should I crop them from the mockups for now? *Default: temporary crops (Task 11, Step 1).*
8. **Web landing page `/`:** `Landing page.png` is the employee phone welcome screen, not a website. *Default: `/` redirects to `/login` until you design a marketing page.*
9. **Phone "Get started" button:** employees can't self-register (they're invited). What should "Get started" do? *Default: open "Join your company" (paste or open an invite link). "Sign in" goes to login.*
10. **Maps:** the spec asks for Google Maps or Mapbox; I've used MapLibre with free CARTO tiles, which needs no key. *Default: MapLibre on web. The mobile choice is decided in Phase 2.* Do you have a Google Maps key with billing enabled?
11. **AI provider for Phase 6:** the old app used Groq (Llama 3.1 8B). *Default: Claude (`claude-haiku-4-5` for per-update summaries, `claude-sonnet-5-5` for period reports).* Which provider and API key will you use?
12. **Hosting:** the web app on Vercel. The API and BullMQ worker need an always-on host (Railway, Render or Fly) plus managed Postgres and Redis. *Default: decided at Phase 7.* Any preference?
13. **Repository:** `origin` still points at `punnoose-creator/Pro-Map`. *Default: keep building here and rename the GitHub repo to `work-trail` when you're ready.* Or should this be a fresh repo?
14. **Button contrast:** white text on the mockup's bright orange is about 3:1, below the 4.5:1 accessibility target for 16px text. *Default: the gradient ends in a slightly deeper orange (`#E84A00`) and small orange text uses `#B83A00`.* Is a slightly deeper orange OK, or must it match the mockup exactly?
