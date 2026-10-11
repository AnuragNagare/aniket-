# Work Trail Phase 8: Three-way entry flow and native admin area in the mobile app

**Goal:** The phone app opens on a welcome screen with three choices. **Get started** is for employees, who paste the admin's invite link once and are then remembered. **Sign in** is for admins (and returning employees). **Register** is for a new admin, who creates an account and organisation. An admin lands in a native admin area: dashboard, employee list, invite flow, employee detail (overview, updates, hours, map), company sessions with close, and account.

**Approved design (2026-10-11):** native screens (not a WebView); map with MapLibre (free tiles, no key); no API changes (every admin endpoint exists).

## Scope

**In:** welcome with 3 buttons; Register screen; role-based routing; admin dashboard; employees list + search + filter; invite (name, email, optional phone/designation/code) with system Share sheet and Resend; employee detail with period picker and 4 tabs; company sessions with Close session; account + sign out.

**Out (stay on the web dashboard):** PDF reports, company settings and retention, deactivate/erase/export, audit log. A "Copy link" button is not built: the Android Share sheet already offers Copy and WhatsApp, and it avoids a new dependency.

## Global constraints

- Everything in `plan.md` constraints still applies: other-company ids 404, error envelope, no "live" wording, orange-on-warm-white look, sentence-case copy.
- One app, two roles. The role comes from the signed token response (`user.role`), never from the client. Admins never start tracking or the upload queue.
- An employee token on an admin route gets 403 from the API (already enforced). The app must not show admin screens to an employee.
- Free API cold start is ~60 s: every admin screen needs loading, empty and error states.
- Memory is limited on this machine: verify with Jest and `tsc` only; no emulator.
- The map cannot be verified without a real device build. Say so in the final report.

## File structure

**Shared (`packages/types/src`):** `period.ts` (presets, `parseRange`, moved from web), `trail-geojson.ts` (moved from web). Web's `src/lib/date-range.ts` and `trail-geojson.ts` become one-line re-exports so web tests and imports keep working.

**Mobile (`apps/mobile/src`):**
- `app/(auth)/welcome.tsx` (3 buttons), `app/(auth)/register.tsx` (new)
- `auth/auth-store.ts` (accept admins, `register`), `app/_layout.tsx` (role guards)
- `app/(admin)/_layout.tsx` (tabs), `index.tsx` (dashboard), `employees/_layout.tsx`, `employees/index.tsx`, `employees/invite.tsx`, `employees/[id].tsx`, `sessions.tsx`, `account.tsx`
- `admin/` data hooks: `use-dashboard.ts`, `use-employees.ts`, `use-employee.ts`, `use-sessions.ts`, `use-invite.ts`
- `admin/format.ts` (minutes, times), `admin/period.ts` (preset chips)
- `components/admin/` : `KpiCard`, `PeriodChips`, `SegmentedTabs`, `EmployeeRow`, `UpdateItem`, `TrailMap` (MapLibre)

## Tasks

### Task 1: Move period and trail helpers into `@worktrail/types`
- Create `packages/types/src/period.ts` and `trail-geojson.ts` from the web files; export from `index.ts`; add tests under `packages/types/test/`.
- Web files re-export; web tests unchanged and must still pass.
- Verify: types, web tests, web typecheck.

### Task 2: Auth store accepts admins and can register
- `adopt()` no longer rejects OWNER/ADMIN; keep the refresh-token storage path identical.
- Add `register(input)` calling `POST /auth/signup/admin` (validated with `AdminSignupSchema`).
- Update `test/auth-store.test.ts` (admins are now accepted) and `test/screens/login.test.tsx` (remove the admin-redirect case).
- Verify: mobile tests for auth.

### Task 3: Welcome (3 buttons) and Register screen
- Welcome: **Get started** → `/join`, **Sign in** → `/login`, **Register** → `/register`. Remove the "Skip" link (it duplicated Sign in). Copy under each button says who it is for.
- Register screen: company name, your name, email, mobile, password; shared Zod validation; server error shown; success signs in via the store.
- Login subtitle becomes "For admins and returning employees."
- Tests: welcome navigation, register validation and success, server error.

### Task 4: Role-based routing and admin shell
- Root layout: `(app)` guarded by `signedIn && role === 'EMPLOYEE'`; `(admin)` by `signedIn && role is OWNER|ADMIN`.
- `(admin)/_layout.tsx`: bottom tabs Dashboard, Employees, Sessions, Account.
- Test the guard logic as a pure helper `homeFor(role)`.

### Task 5: Admin data hooks
- React Query hooks over `api.request` for dashboard, employee list (query, status, page), employee detail/summary/updates/sessions/trail (period), invite, resend, close session, work sessions.
- Tests with the API client mocked: correct URLs and query strings, 403/404 surfaced.

### Task 6: Dashboard, Employees, Invite
- Dashboard: greeting, KPI cards, recent updates (with AI summary when present).
- Employees: search box, All/Working/Off duty chips, rows with status and "Invited" badge, pull to refresh, invite button.
- Invite: form, then result panel with **Share link** (system Share sheet) and a note when `emailSent` is false; Resend on invited rows.
- Tests per screen: loading, empty, error, data.

### Task 7: Employee detail (Overview, Updates, Hours) and Sessions
- Period chips (Today, Yesterday, This week, Last week, This month; Custom is not in the first version). Segmented tabs.
- Hours tab and Sessions screen: **Close session** with an end-time choice limited to [start, now] and a confirm dialog; server error shown.
- Tests: period → query string, close flow, labels from `sessionLabel`.

### Task 8: Map tab
- Add `@maplibre/maplibre-react-native` (check Expo 57 / RN 0.86 compatibility first) and its config plugin.
- `TrailMap` renders route lines, gap dashes, approximate-point dots and S/E markers from `trailToGeoJson`, free CARTO tiles, fit to bounds. If the native module is unavailable, show a plain text fallback listing the points, so the tab never crashes.
- Tests: GeoJSON is covered by Task 1; component test with the module mocked (renders, empty state, fallback).

### Task 9: Docs and verification
- Update `docs/device-test-android.md` with an admin-flow checklist; mark map and Share as unverified.
- Run: types, web, mobile tests; mobile and web typecheck; mobile lint.
- Commit on the working branch. Nothing is pushed without a yes.

## Review focus

1. An employee who signs in on Sign in still lands on the employee home, and an admin never sees Start work.
2. An employee cannot open admin routes (guard) and the API still returns 403 for admin endpoints.
3. Register with an email that exists shows the server's `EMAIL_TAKEN` message, not a crash.
4. Cold-start timeouts show a retry state, not a blank screen.
5. The map never crashes the app when the native module or tiles are unavailable.

## Open questions (defaults)

1. **Custom period in the app.** *Default: not in the first version.*
2. **Employees using Sign in.** *Default: allowed; they land on the employee home.*
3. **Register collects the company name** on the same form. *Default: yes, one step.*
