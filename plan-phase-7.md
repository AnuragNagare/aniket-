# Work Trail Phase 7: Hardening, Privacy and Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Work Trail safe to hand to five real companies:
- every sensitive action is audited;
- errors reach us before customers complain;
- data is backed up and can be restored;
- precise locations are deleted after each company's retention period (default 90 days);
- employees give recorded consent before tracking;
- admins can export or delete an employee's data;
- the Android app is tested on the phone brands Indian field teams actually use;
- the whole thing runs on real hosting with a written pilot playbook.

**Architecture:**
- No new subsystems. This phase adds to what exists:
  - a `privacy` module (consent, export, deletion);
  - a `settings` module (company profile, retention, audit log viewer);
  - a `maintenance` processor on the existing Phase 6 queue (retention purge, export and deletion jobs);
  - request-scoped context (request id, IP, user agent) for logs and audit rows;
  - Sentry in all three apps.
- **Deployment:** a production `Dockerfile` for the API, which also runs the worker; an S3-compatible `FileStorage` driver for PDFs and exports; GitHub Actions CI; nightly database backups to object storage with a tested restore.
- **People work (no code):** the device test matrix and the pilot are documented procedures with sign-off tables.

**Tech Stack:** Same as before, plus:
- `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/react-native`
- `helmet`
- `nestjs-cls` (request context)
- `@aws-sdk/client-s3` (for R2 or S3)
- `archiver` (export ZIP)
- EAS Build (Android release builds)
- GitHub Actions
- `gitleaks` (secret scanning in CI)

**Spec:**
- `docs/specs/plan.pdf` → "Phase 7 — Hardening and pilot" (all four items) and "Definition of done":
  - no secrets committed
  - every endpoint has auth and organisation tests
  - every UI state is handled
  - the physical Android test is documented **with observed OS behaviour**
- `docs/specs/prd.pdf`:
  - §6: TLS, short-lived tokens, audit logs for "invitations, admin access, exports, session changes, and deletion requests"; "Data retention must be configurable per organisation; recommended default: 90 days of precise location data"
  - §7 (all of it)
  - §8 success metrics
  - §9 risks
  - §10 acceptance criteria
- `docs/specs/data-model.pdf`:
  - `companies.precise_location_retention_days`
  - `location_points` "organisation/time index for retention deletion"
  - `audit_logs` (actor, company, action, entity, IP/device metadata; at minimum invitation creation/acceptance, report export, role changes, session overrides, deletion requests)
- `plan.md` Open Questions 12 (hosting) and 13 (repository).
- `docs/device-test-android.md`: its "Observed" column currently describes what the code is *meant* to do, not what a phone did. Task 10 replaces it with real observations.

**Assumes Phases 1b–6 are complete.**

---

## What we're building (plain summary)

**For employees (phone)**
- **Privacy screen before tracking.** On first Start work, and again whenever we change the wording:
  - one screen in plain English (Hindi in Open Question 5) covering what is collected, when, why, who can see it, how long it's kept, and how to stop it;
  - a **I understand and agree** button that records consent: version, time, device, app version;
  - no Start work until it's accepted.
- **Profile → Privacy:**
  - shows the same text again, the date they agreed, and their company's retention ("Precise locations are deleted after 90 days");
  - a **Ask my company to delete my data** button that sends a deletion request to the admin.

**For admins (web)**
- **Settings `/app/settings`** (the sidebar item already exists). Four tabs:
  - **Company:** name and timezone.
  - **Privacy & data:** location retention in days, 30–365 (default 90). Saving shows "Locations older than N days will be deleted tonight." The pending deletion requests are listed here.
  - **Audit log:** who did what and when (invites, sign-ins by admins, report downloads, exports, session closes, settings changes, deletions), filterable by action and date.
  - **My account:** name, phone, change password.
- **Employee page → a "…" menu** with:
  - **Deactivate / Reactivate:** blocks sign-in, ends any running session, signs them out everywhere;
  - **Send password reset link**;
  - **Export data:** a ZIP of their sessions, locations and updates as CSV;
  - **Delete employee data:** typed confirmation; locations, updates, summaries, reports and sessions are deleted; the employee is anonymised; the audit log keeps the fact that it happened.
- The employee header shows "Agreed to tracking on 6 Oct 2026", or "Has not agreed yet".

**Behind the scenes**
- A nightly retention job deletes precise locations older than each company's retention period, in batches, and records how many were removed.
- Sentry catches errors in the API, worker, web and app, with personal data scrubbed. Every API log line has a request id.
- Security headers, stricter production settings (no plain-HTTP traffic from release builds), CI that runs every test and scans for leaked secrets on each push.
- A production setup: API + worker container, managed Postgres with PostGIS, Redis, private object storage for files, nightly backups, a restore drill, and uptime checks.
- **Pilot kit:**
  - `docs/pilot-playbook.md` (onboarding call script, week-by-week checklist, support routine);
  - a metrics script measuring the PRD success numbers;
  - a filled-in Android device matrix.

**API**

| Endpoint | Does |
|---|---|
| `GET /privacy/notice` | Current notice text and version (public to signed-in users). |
| `POST /me/consent` `{ version, appVersion, deviceModel }` | Employee records consent. |
| `POST /sessions/start` | Now `409 CONSENT_REQUIRED` without consent to the current version. |
| `POST /me/deletion-request` `{ reason? }` | Employee asks for deletion (one open request at a time). |
| `GET /company` / `PATCH /company` | Company name, timezone, retention days (OWNER/ADMIN; retention change audited). |
| `GET /audit-logs?action&from&to&page` | Company audit log (OWNER/ADMIN). |
| `GET /deletion-requests` | Open requests. |
| `POST /deletion-requests/:id/dismiss` `{ note }` | Dismiss a request. |
| `POST /employees/:id/deactivate`, `/reactivate`, `/password-reset` | Support tools. |
| `POST /employees/:id/exports` | Queues a ZIP export (shares the Phase 6 report storage and download pattern). |
| `GET /exports/:id`, `GET /exports/:id/download` | Export status and file. |
| `POST /employees/:id/erase` `{ confirmName }` | Queues erasure. 202 + job. |
| `GET /health/ready` | Database and Redis reachable (for the host's health check); `/health` stays liveness. |

**Not in Phase 7:** OTP login; multiple admin roles or admin invites (Open Question 3); iOS; billing; self-serve company deletion (done on request by us during the pilot, with the script in Task 7); a SOC2-style policy pack.

---

## Files to create and change

### Changed files

| File | What changes |
|---|---|
| `.env.example` | Add `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`, `STORAGE_DRIVER` (`local`/`s3`), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `TRUST_PROXY`, `EXPORT_TTL_DAYS=7`, `RETENTION_RUN_HOUR_IST=2`. |
| `apps/api/package.json` | Add `@sentry/nestjs`, `helmet`, `nestjs-cls`, `@aws-sdk/client-s3`, `archiver` (+ types). Script `ops:erase-company` (Task 7). |
| `apps/api/src/config/env.ts` | Validate the new variables. Production requires `SENTRY_DSN`, plus the `S3_*` settings when `STORAGE_DRIVER=s3`. Production refuses `STORAGE_DRIVER=local` unless `ALLOW_LOCAL_STORAGE=true`. |
| `apps/api/src/main.ts`, `apps/api/src/bootstrap.ts` | `instrument.ts` (Sentry) is imported first. Add `helmet()`. `app.set('trust proxy', env.TRUST_PROXY)`. Swagger only when not production. Body size limit 1 MB. |
| `apps/api/src/worker.ts` | Import `instrument.ts`. Schedule `maintenance.retention` daily and `maintenance.sweep` every 2 min. |
| `apps/api/src/app.module.ts` | Import `ClsModule` (request id, IP, user agent), `SettingsModule`, `PrivacyModule`, `AdminToolsModule`. Request logging middleware. |
| `apps/api/prisma/schema.prisma` | New models `ConsentRecord`, `DeletionRequest`, `DataExport`. `Employee`: `deletedAt DateTime?`. `AuditLog`: `ip String? @db.VarChar(64)`, `userAgent String? @db.VarChar(255)`, `@@index([companyId, action, createdAt])`. `Company`: a check that retention is between 30 and 365 (SQL `CHECK` in the migration). |
| `apps/api/prisma/seed.ts` | Demo employees have consent to the current version, except one (to show "Has not agreed yet"). One open deletion request. Some audit rows. |
| `apps/api/src/common/audit/audit.service.ts` | Reads IP and user agent from CLS automatically. New actions: `admin.signed_in`, `company.updated`, `retention.updated`, `retention.purged`, `consent.recorded`, `deletion.requested`, `deletion.dismissed`, `employee.deactivated`, `employee.reactivated`, `employee.password_reset_sent`, `employee.erased`, `export.requested`, `export.downloaded`. New entity types: `company`, `employee`, `export`, `deletion_request`. |
| `apps/api/src/modules/auth/services/auth.service.ts` | Audit `admin.signed_in` on OWNER/ADMIN login (not employees, to keep the log readable). A deactivated user (`status: DISABLED`) gets `401 ACCOUNT_DISABLED` "This account has been turned off by your company." Refresh fails the same way. |
| `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` | Rejects a token whose user is `DISABLED` (checked from a 60-second in-memory cache keyed by user id, so deactivation takes effect within a minute without a database hit per request). |
| `apps/api/src/modules/sessions/services/sessions.service.ts` | `start()` requires current consent → `409 CONSENT_REQUIRED` "Please read and accept the privacy notice first." Exposes `endForAdmin(employeeId, reason)`, used by deactivate and erase. |
| `apps/api/src/modules/employees/services/employees.service.ts` | `EmployeeDetail` gains `consentedAt: string \| null`, `consentVersion: string \| null`, `deactivated: boolean`. List and get exclude `deletedAt != null`. |
| `apps/api/src/modules/summaries/services/summary-sweeper.service.ts` | Also removes expired export files. |
| `apps/api/src/common/storage/storage.module.ts` | Picks `local` or `s3` from `STORAGE_DRIVER`. |
| `apps/api/src/modules/health/*` | Add `GET /health/ready`. |
| `packages/types/src/index.ts` | Export `privacy.ts`, `settings.ts`, `audit.ts`. |
| `packages/types/src/employees.ts` (or wherever `EmployeeDetail` lives after Phase 5) | The three new fields. |
| `apps/web/package.json`, `apps/web/next.config.ts` | `@sentry/nextjs` (`withSentryConfig`, source maps uploaded only in CI). Security headers: `Content-Security-Policy` (self, CARTO tiles and fonts, Sentry ingest), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. |
| `apps/web/src/app/app/employees/[id]/layout.tsx`, `components/employee-detail/employee-header.tsx` | Consent line and a "Deactivated" badge. The "…" actions menu. |
| `apps/web/src/lib/session.ts` (BFF) | Maps `401 ACCOUNT_DISABLED` to the login page with that message. |
| `apps/mobile/app.json` | Release builds: `usesCleartextTraffic: false` (only the `development` EAS profile keeps it true, via `app.config.ts`). Sentry plugin. |
| `apps/mobile/src/app/(app)/permissions.tsx` | Starts with the privacy notice step (from `GET /privacy/notice`) before the OS permission prompts, and records consent. |
| `apps/mobile/src/app/(app)/profile.tsx` | "Privacy" section: the notice, the agreed date, retention, and "Ask my company to delete my data". |
| `apps/mobile/src/sessions/use-work-session.ts` | On `409 CONSENT_REQUIRED`, route to `/permissions?step=notice`. |
| `apps/mobile/src/api/client.ts` | On `401 ACCOUNT_DISABLED`: clear tokens, stop tracking, wipe the outbox, show the message on the login screen. |
| `docs/device-test-android.md` | Rewritten as a brand × scenario matrix with real observed results (Task 10). |
| `README.md` | Production section: environment, deploy, worker, backups, restore, on-call basics. |
| `.gitignore` | `apps/api/storage/`, `*.dump`, `.sentryclirc`. |

### New files

```
packages/types/src/privacy.ts          PRIVACY_NOTICE_VERSION, PrivacyNotice, ConsentSchema, DeletionRequestSchema/Dto, DataExportDto
packages/types/src/settings.ts         CompanySettings, UpdateCompanySchema (retention 30–365), MyAccount schemas
packages/types/src/audit.ts            AUDIT_ACTION_LABELS, AuditLogQuerySchema, AuditLogItem, AuditLogResponse
packages/types/test/privacy.test.ts

apps/api/prisma/migrations/<ts>_privacy_and_hardening/migration.sql
apps/api/src/instrument.ts                                   Sentry init + PII scrubbing (beforeSend)
apps/api/src/common/context/request-context.ts               CLS setup: requestId, ip, userAgent, userId
apps/api/src/common/logging/request-logger.middleware.ts     one JSON line per request, no bodies
apps/api/src/common/storage/s3.storage.ts
apps/api/src/modules/privacy/privacy.module.ts
apps/api/src/modules/privacy/notice.ts                       the notice text (versioned)
apps/api/src/modules/privacy/services/consent.service.ts
apps/api/src/modules/privacy/services/deletion-requests.service.ts
apps/api/src/modules/privacy/services/erasure.service.ts      processor: deletes and anonymises one employee
apps/api/src/modules/privacy/services/exports.service.ts      request/list/download + processor (ZIP of CSVs)
apps/api/src/modules/privacy/services/retention.service.ts    processor: nightly purge
apps/api/src/modules/privacy/controllers/{privacy,me-privacy,deletion-requests,exports,erase}.controller.ts
apps/api/src/modules/settings/settings.module.ts
apps/api/src/modules/settings/services/{company-settings,audit-log}.service.ts
apps/api/src/modules/settings/controllers/{company,audit-logs}.controller.ts
apps/api/src/modules/admin-tools/admin-tools.module.ts
apps/api/src/modules/admin-tools/services/employee-access-tools.service.ts   deactivate / reactivate / reset link
apps/api/src/modules/admin-tools/controllers/employee-tools.controller.ts
apps/api/scripts/erase-company.ts                              ops script, typed confirmation, audited
apps/api/scripts/pilot-metrics.ts                              PRD §8 numbers per company
apps/api/Dockerfile                                            multi-stage; one image runs API or worker
apps/api/.dockerignore
apps/api/test/e2e/consent.e2e-spec.ts
apps/api/test/e2e/retention.e2e-spec.ts
apps/api/test/e2e/exports.e2e-spec.ts
apps/api/test/e2e/erasure.e2e-spec.ts
apps/api/test/e2e/admin-tools.e2e-spec.ts
apps/api/test/e2e/settings.e2e-spec.ts
apps/api/test/e2e/authz-matrix.e2e-spec.ts                     every route × {no token, employee, other company}
apps/api/test/unit/sentry-scrub.spec.ts
apps/api/test/unit/s3-storage.spec.ts

apps/web/sentry.client.config.ts, sentry.server.config.ts, instrumentation.ts
apps/web/src/app/app/settings/{layout,page}.tsx                Company tab
apps/web/src/app/app/settings/privacy/page.tsx
apps/web/src/app/app/settings/audit/page.tsx
apps/web/src/app/app/settings/account/page.tsx
apps/web/src/app/app/settings/actions.ts
apps/web/src/app/app/employees/[id]/admin-actions.ts           deactivate, reactivate, reset link, export, erase
apps/web/src/app/api/exports/[id]/download/route.ts            BFF stream (same as reports)
apps/web/src/components/settings/{company-form,retention-form,audit-table,deletion-requests,account-form}.tsx
apps/web/src/components/employee-detail/{employee-actions-menu,erase-dialog,consent-line}.tsx
apps/web/test/settings.test.tsx
apps/web/test/employee-actions.test.tsx

apps/mobile/app.config.ts                                      wraps app.json; per-profile cleartext + Sentry
apps/mobile/eas.json                                           development / preview (APK) / production (AAB) profiles
apps/mobile/src/privacy/{use-notice,use-consent,use-deletion-request}.ts
apps/mobile/src/components/PrivacyNotice.tsx
apps/mobile/test/privacy.test.tsx

.github/workflows/ci.yml                                       install, lint, typecheck, unit + e2e (Postgres/Redis services), build
.github/workflows/secrets.yml                                  gitleaks on every push and PR
infra/backup/backup.sh                                         pg_dump → gzip → age-encrypt → S3, keep 30 daily + 12 monthly
infra/backup/restore.sh                                        download → decrypt → pg_restore into a scratch database → row counts
infra/backup/README.md                                         schedule, keys, restore drill record
docs/production.md                                             hosting layout, env, deploy steps, rollbacks, incident basics
docs/pilot-playbook.md                                         who, onboarding, weekly checks, support, exit criteria
docs/privacy-notice.md                                         the employee notice + the admin-facing data summary (for legal review)
```

---

## Global Constraints

- Everything in `plan.md` → Global Constraints and the earlier phase plans still applies.
- **Definition of done (plan.pdf), checked in Task 11:**
  - TypeScript compiles with no errors; lint and tests pass.
  - **Every endpoint has authentication and organisation tests** (Task 2's matrix).
  - Every UI state (loading, empty, success, failure) is handled.
  - **No API key or secret is committed** (gitleaks in CI, plus a one-time history scan).
  - The physical Android test is documented **with observed OS behaviour**.
- **Audit (PRD §6, data-model):**
  - Covers invitations, admin access (admin sign-ins), exports (reports and data exports), session changes (admin close, deactivation ending a session), role changes (none exist yet; the action name is reserved), settings changes and deletion requests.
  - Audit rows carry IP and user agent.
  - Audit rows are never edited or deleted by the app, and erasure keeps them. They contain ids and counts, never update text or coordinates.
- **Retention (PRD §6):**
  - Per company, 30–365 days, default 90.
  - Applies to `location_points` by `captured_at`.
  - Sessions, hours and updates are kept: they are the work record. PDFs expire after 30 days (Phase 6), exports after 7.
  - The purge runs daily at 02:00 IST in batches of 5,000 rows, using the `(company_id, captured_at)` index.
  - Each run writes one `retention.purged` audit row per company with the count.
- **Consent (PRD §7):**
  - "Employee must see a clear disclosure before tracking starts: what is collected, when, why, who can view it, and how to stop it."
  - Consent is per employee and per notice version. Changing `PRIVACY_NOTICE_VERSION` asks everyone again on their next Start work.
  - The server enforces it, not just the app.
  - "Obtain legal review before commercial launch": `docs/privacy-notice.md` is written for that review. **The pilot must not start until the user confirms the review is done or explicitly waived for the pilot** (Task 12 gate).
- **Erasure:**
  - Deletes location points, updates, generated summaries, reports (rows and files), exports and work sessions for that employee.
  - Revokes refresh tokens.
  - Sets the user to `DISABLED` with the email replaced by `deleted+<id>@invalid`. Sets the employee name to "Deleted employee" and clears phone, email and code. Sets `deletedAt`.
  - Done in batches inside a job, with one `employee.erased` audit row with counts.
  - Irreversible. The confirmation must type the employee's exact name.
- **Export:**
  - A ZIP containing `sessions.csv`, `locations.csv`, `updates.csv` (with AI summaries) and `README.txt` (what each column means, the timezone, the export date).
  - Times are in ISO UTC plus a company-local column.
  - Private storage, 7-day expiry, admin-only download, audited.
- **Sentry:**
  - `sendDefaultPii: false`.
  - `beforeSend` removes request bodies, cookies, `Authorization` headers, query strings on `/auth/*` and `/invitations/*`, and any key matching `/password|token|secret|latitude|longitude|text|email|phone/i`.
  - User context is the user id only.
  - Traces sample rate 0.1 in production.
  - No session replay.
- **Logs:** one JSON line per request: `requestId`, method, route pattern (not the raw URL), status, ms, `userId`, `companyId`. No bodies, no query strings. The `x-request-id` header is returned to clients and shown on the web error page ("Reference: …") for support.
- **Production settings:**
  - TLS terminated by the host.
  - `trust proxy` set so rate limits and audit IPs are real client IPs.
  - Swagger off.
  - CORS only for `WEB_ORIGIN`.
  - Release Android builds can't use plain HTTP.
  - Refresh-token reuse detection from Phase 1 is kept.
- **Backups:**
  - Managed Postgres point-in-time recovery if the host offers it, **plus** our own nightly encrypted `pg_dump` to a different provider's bucket.
  - **A backup that has never been restored doesn't count:** Task 9 includes a restore drill with recorded row counts.
- **Low memory:** test with `QUEUE_DRIVER=inline` and the production web build. Run Docker image builds one at a time.

## Review Focus

1. **The authorisation matrix.** Every route, called with no token, an employee token (on admin routes), an admin token (on employee-only routes) and another company's admin, must give 401/403/404 as designed, and never 200 or 500.
   - Test in Task 2 (generated from Nest's route table, so new routes can't be forgotten).
2. **Retention correctness.**
   - Deletes exactly the rows older than *that company's* setting and nothing from other companies.
   - Never touches sessions or updates.
   - Survives a run interrupted halfway, because the next run continues.
   - Changing retention from 90 to 30 deletes 31–90-day-old points on the next run (the UI says so beforehand).
   - Test in Task 4.
3. **Erasure completeness.**
   - After erasure, no table has a row with that employee id except `audit_logs` (ids only) and the anonymised `employees`/`users` rows.
   - Files are gone from storage.
   - The deactivated user can't sign in or refresh, and the phone stops tracking on its next call.
   - Test in Task 6.
4. **Consent cannot be bypassed.**
   - `POST /sessions/start` without consent → 409, even from an old app build.
   - Bumping the version makes everyone accept again.
   - Consent rows can't be written for another employee.
   - Test in Task 3.
5. **No personal data leaks into Sentry or logs.**
   - Unit test the scrubber with a fake event containing a password, a token, coordinates, update text and a phone number.
   - Grep a day of local logs for `@`, `+91`, `"latitude"`.
   - Test in Task 1.

---

### Task 1: Request context, logs, security headers and Sentry

**Files:**
- Create: `apps/api/src/instrument.ts`, `apps/api/src/common/context/request-context.ts`, `apps/api/src/common/logging/request-logger.middleware.ts`, `apps/api/test/unit/sentry-scrub.spec.ts`, `apps/web/sentry.*.config.ts`, `apps/web/instrumentation.ts`
- Modify: `apps/api/{package.json, src/main.ts, src/bootstrap.ts, src/worker.ts, src/app.module.ts, src/config/env.ts, src/common/audit/audit.service.ts}`, `apps/web/{package.json, next.config.ts, src/app/app/error.tsx}`, `apps/mobile/{app.config.ts, src/app/_layout.tsx}`, `.env.example`

**Interfaces:**
- Produces:
  - `scrubEvent(event): event`, exported from `instrument.ts` for tests
  - CLS keys `requestId`, `ip`, `userAgent`, `userId`, `companyId`
  - an `x-request-id` response header
  - `AuditService.record` fills `ip` and `userAgent` from CLS when they aren't passed

- [ ] **Step 1: Write the failing tests.**
  - `sentry-scrub.spec.ts`: an event with `request.data`, `request.cookies`, an `Authorization` header, a query string `token=abc` on `/api/v1/invitations/x`, `extra: { latitude: 19.07, text: 'Met client', phone: '+919800000000' }` and `user: { email }` comes out with all of them removed, and `user` reduced to `{ id }`.
  - In an existing e2e spec (`health.e2e-spec.ts`):
    - responses carry `x-request-id` (a UUID, or the incoming header when it's a valid UUID);
    - `x-powered-by` is absent;
    - `strict-transport-security` is present when `NODE_ENV=production` (tested by creating the app with an env override);
    - an audit row written during a request (invite in `invitations.e2e-spec.ts`) has `ip` and `userAgent` set.

  Run → FAIL.
- [ ] **Step 2: Implement.**
  - Install `@sentry/nestjs helmet nestjs-cls` in the API and `@sentry/nextjs` in the web app. Install `@sentry/react-native` in mobile with `npx expo install` (it brings its config plugin).
  - `instrument.ts`: `Sentry.init({ dsn: env.SENTRY_DSN, environment, tracesSampleRate: prod ? 0.1 : 0, sendDefaultPii: false, beforeSend: scrubEvent, beforeSendTransaction: scrubEvent })`. It does nothing without a DSN, so dev and test are untouched. `main.ts` and `worker.ts` import it first. Register `SentryModule.forRoot()` and the Sentry global filter **before** `ErrorEnvelopeFilter`, so only 5xx errors are reported. Inside our filter, call `Sentry.captureException` only for non-`AppError` exceptions.
  - `ClsModule.forRoot({ global: true, middleware: { mount: true, generateId: true, idGenerator: (req) => validUuid(req.headers['x-request-id']) ?? randomUUID(), setup: (cls, req) => { cls.set('ip', req.ip); cls.set('userAgent', String(req.headers['user-agent'] ?? '').slice(0, 255)); } } })`. `JwtAuthGuard` sets `userId` and `companyId` after verification.
  - `request-logger.middleware.ts`: on `res.finish`, log `{ requestId, method, route: req.route?.path ?? 'unmatched', status, ms, userId, companyId }`, and set the `x-request-id` header.
  - `bootstrap.ts`:
    - `app.use(helmet({ contentSecurityPolicy: false }))` (JSON API);
    - `app.getHttpAdapter().getInstance().disable('x-powered-by')`;
    - `app.set('trust proxy', env.TRUST_PROXY)`;
    - Swagger only when `NODE_ENV !== 'production'`;
    - `json({ limit: '1mb' })`.
  - **Web:** `withSentryConfig` in `next.config.ts` plus the `headers()` security headers listed in the changed-files table. The CSP allows `self`, `https://*.cartocdn.com`, `https://tiles.basemaps.cartocdn.com`, `blob:` for the MapLibre worker, and the Sentry ingest host. `error.tsx` shows "Reference: {digest}".
  - **Mobile:** `Sentry.init` in the root layout, with `sendDefaultPii: false` and the same `beforeSend` (copied into `src/monitoring.ts`; a shared package isn't worth it). Wrap the root with `Sentry.wrap`.
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` (all workspaces) → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat: request ids, JSON request logs, security headers and scrubbed Sentry"`

---

### Task 2: Authorisation matrix test for every route (API)

**Files:**
- Create: `apps/api/test/e2e/authz-matrix.e2e-spec.ts`

**Interfaces:**
- Consumes: Nest's `DiscoveryService` / `MetadataScanner`, plus the `@Public()` and `@Roles()` metadata. That gives a list of `{ method, path, public, roles }` for every route.

- [ ] **Step 1: Write the test** (it should pass for existing routes; any failure is a real bug to fix in this task).
  - Build the route list at runtime.
  - Fill path params with a real resource id from **company B** (seeded: employee, session, report, export, summary, deletion request, invitation) or a random UUID when none applies.
  - For each non-public route, assert:
    1. **No token → 401.**
    2. **The wrong role → 403.** That is, an employee token on `@Roles('OWNER','ADMIN')` routes, and an admin token on employee-only routes.
    3. **Company A admin on a company B id → 404** (or 403 where the route has no id), never 200.
    4. The response is never a 5xx and always follows the error envelope.

  Request bodies are minimal valid payloads from a per-route fixture map. A route missing from the map fails the test with "add a fixture for METHOD /path", so new routes can't skip this check.
- [ ] **Step 2: Run it.** `pnpm --filter @worktrail/api test:e2e -- authz-matrix`. Fix anything it finds in the owning module, with its own focused test.
- [ ] **Step 3: Commit.** `git commit -m "test(api): authorisation matrix across every route"`

---

### Task 3: Privacy notice and consent (types, API, mobile, web)

**Files:**
- Create: `packages/types/src/privacy.ts`, `packages/types/test/privacy.test.ts`, `apps/api/src/modules/privacy/{privacy.module.ts, notice.ts, services/consent.service.ts, controllers/privacy.controller.ts, controllers/me-privacy.controller.ts}`, the migration, `apps/api/test/e2e/consent.e2e-spec.ts`, `apps/mobile/src/privacy/{use-notice,use-consent}.ts`, `apps/mobile/src/components/PrivacyNotice.tsx`, `apps/mobile/test/privacy.test.tsx`, `apps/web/src/components/employee-detail/consent-line.tsx`, `docs/privacy-notice.md`
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/src/modules/sessions/services/sessions.service.ts`, `apps/api/src/modules/employees/services/employees.service.ts`, `apps/mobile/src/app/(app)/permissions.tsx`, `apps/mobile/src/sessions/use-work-session.ts`, `apps/web/src/components/employee-detail/employee-header.tsx`, `apps/api/prisma/seed.ts`

**Interfaces:**
- Produces:
  - `PRIVACY_NOTICE_VERSION = '2026-10-v1'`
  - `PrivacyNotice { version; title; sections: Array<{ heading; body }>; retentionDays }`. `retentionDays` is filled in per company.
  - `ConsentSchema { version; appVersion; deviceModel }`
  - `ConsentService.current(employeeId) → { version; acceptedAt } | null`
  - `ConsentService.require(employeeId)`, which throws 409 `CONSENT_REQUIRED`
  - `GET /privacy/notice`
  - `POST /me/consent` → 201 `{ version, acceptedAt }`. It's idempotent per version and returns the existing row.

Prisma model:
```prisma
model ConsentRecord {
  id          String   @id @default(uuid()) @db.Uuid
  companyId   String   @map("company_id") @db.Uuid
  employeeId  String   @map("employee_id") @db.Uuid
  version     String   @db.VarChar(32)
  acceptedAt  DateTime @default(now()) @map("accepted_at") @db.Timestamptz
  appVersion  String?  @map("app_version") @db.VarChar(32)
  deviceModel String?  @map("device_model") @db.VarChar(80)
  ip          String?  @db.VarChar(64)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  company  Company  @relation(fields: [companyId], references: [id])
  @@unique([employeeId, version])
  @@map("consent_records")
}
```

**Notice content** (`notice.ts`, mirrored in `docs/privacy-notice.md`). Six short sections:
1. **What we collect:** location (latitude, longitude, accuracy, speed, battery level) about every 5 minutes; the start and end times of work; the updates you write or speak.
2. **When:** only between Start work and End work. Never when you're off duty. A notification is always visible while it's on.
3. **Why:** so your company can see work hours, routes between work locations, and your reports.
4. **Who can see it:** admins of {company name}. Work Trail staff only for support, when your company asks. AI summaries are made from your update text only. Your location is never sent to the AI.
5. **How long:** precise locations are deleted after {retentionDays} days. Work hours and updates are kept as your company's work record.
6. **Your choices:** tap End work at any time to stop. Turn off location permission in Android settings. Ask your company to delete your data from Profile → Privacy.

- [ ] **Step 1: Write the failing tests.**
  - `consent.e2e-spec.ts`:
    - a new employee's `POST /sessions/start` → 409 `CONSENT_REQUIRED`;
    - `GET /privacy/notice` returns version, sections and the company's retention days;
    - `POST /me/consent` → 201, then start works;
    - a second consent with the same version returns the same `acceptedAt`;
    - a wrong `version` → 400 "Please reload the notice and try again.";
    - after the test sets the constant through a config override (`PRIVACY_NOTICE_VERSION_OVERRIDE` in test env), start → 409 again;
    - an admin token on `POST /me/consent` → 403;
    - `GET /employees/:id` shows `consentedAt`;
    - the audit row `consent.recorded` exists with `ip`.
  - Mobile `privacy.test.tsx`:
    - the permissions flow shows the notice first, and the **I understand and agree** button posts consent and then moves to the location permission step;
    - a 409 `CONSENT_REQUIRED` from Start work routes to the notice;
    - the retention number appears in the text.
  - Web: `ConsentLine` shows "Agreed to tracking on 6 Oct 2026" or "Has not agreed to tracking yet".

  Run → FAIL.
- [ ] **Step 2: Implement.**
  - Migration: the `consent_records` table.
  - `ConsentService`.
  - Wire `require` into `SessionsService.start` **before** any write.
  - `EmployeeDetail` fields.
  - Mobile:
    - a `PrivacyNotice` component (scrollable, headings, a large orange button, and a "Not now" text button that goes back to Home);
    - consent sent with `Application.nativeApplicationVersion` and `Device.modelName` (`expo-application`, `expo-device`);
    - the notice cached in TanStack Query.
  - Seed: every demo employee consents except Rohit.
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat: privacy notice and recorded consent before tracking"`

---

### Task 4: Company settings, retention setting and nightly purge

**Files:**
- Create: `packages/types/src/settings.ts`, `apps/api/src/modules/settings/**`, `apps/api/src/modules/privacy/services/retention.service.ts`, `apps/api/test/e2e/settings.e2e-spec.ts`, `apps/api/test/e2e/retention.e2e-spec.ts`, `apps/web/src/app/app/settings/{layout,page,privacy/page,account/page,actions}.tsx`, `apps/web/src/components/settings/{company-form,retention-form,account-form}.tsx`, `apps/web/test/settings.test.tsx`
- Modify: the migration (retention `CHECK`), `apps/api/src/worker.ts` (schedule), `apps/api/src/common/queue/{job-queue.ts, job-router.ts}` (`maintenance.retention`)

**Interfaces:**
- Produces:
  - `UpdateCompanySchema { name?; timezone? (IANA, validated with Intl); preciseLocationRetentionDays? (30–365) }`
  - `GET/PATCH /company` (OWNER/ADMIN). A change of retention is audited as `retention.updated` with `{ from, to }`; other changes as `company.updated` with the changed field names only.
  - `PATCH /me/account { name?, phone? }` and `POST /me/password { current, next }` (admins; employees keep the mobile Profile)
  - `RetentionService.run(now = new Date()): Promise<Array<{ companyId; deleted }>>`

```ts
/** Deletes precise locations older than each company's retention period, 5,000 rows at a time. */
async run(now = new Date()) {
  const companies = await this.prisma.company.findMany({ select: { id: true, preciseLocationRetentionDays: true } });
  const results = [];
  for (const c of companies) {
    const cutoff = new Date(now.getTime() - c.preciseLocationRetentionDays * 86_400_000);
    let deleted = 0;
    for (;;) {
      const n = await this.prisma.$executeRaw`
        DELETE FROM location_points WHERE id IN (
          SELECT id FROM location_points WHERE company_id = ${c.id}::uuid AND captured_at < ${cutoff}
          LIMIT ${BATCH})`;
      deleted += n;
      if (n < BATCH) break;
    }
    if (deleted > 0) {
      await this.audit.record({ companyId: c.id, action: 'retention.purged', entityType: 'company', entityId: c.id, metadata: { deleted, cutoff: cutoff.toISOString() } });
    }
    results.push({ companyId: c.id, deleted });
  }
  return results;
}
```
Scheduled with the BullMQ job scheduler using the cron pattern `0 2 * * *` and `tz: 'Asia/Kolkata'`. In inline mode a daily `setInterval` check runs instead.

- [ ] **Step 1: Write the failing tests.**
  - `retention.e2e-spec.ts`:
    - company A (90 days) and company B (30 days), each with points at 10, 45 and 120 days old;
    - after `run()`: A keeps the 10- and 45-day points, B keeps only the 10-day one;
    - sessions and updates are untouched;
    - one audit row per company with a non-zero count;
    - running it again deletes 0 and writes no new audit rows;
    - 12,000 old points are deleted across batches.
  - `settings.e2e-spec.ts`:
    - `PATCH /company { preciseLocationRetentionDays: 20 }` → 400 "Choose between 30 and 365 days.";
    - `400` → same;
    - `60` → 200 with an audit row `retention.updated { from: 90, to: 60 }`;
    - timezone `Mars/Base` → 400;
    - an employee token → 403;
    - `POST /me/password` with the wrong current password → 400 "Your current password is incorrect.", and with the right one → 200 with all other refresh tokens revoked.
  - Web `settings.test.tsx`:
    - the retention form warns "Locations older than 60 days will be deleted tonight. This can't be undone." before saving when the number goes **down**;
    - the company form shows field errors;
    - the tabs render.

  Run → FAIL.
- [ ] **Step 2: Implement** the services, controllers and pages (same Card and form styles as `employees/new`). Settings layout tabs: Company · Privacy & data · Audit log · My account.
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat: company settings, per-company retention and nightly location purge"`

---

### Task 5: Audit log coverage and viewer

**Files:**
- Create: `packages/types/src/audit.ts`, `apps/api/src/modules/settings/services/audit-log.service.ts`, `apps/api/src/modules/settings/controllers/audit-logs.controller.ts`, `apps/web/src/app/app/settings/audit/page.tsx`, `apps/web/src/components/settings/audit-table.tsx`
- Modify: `apps/api/src/modules/auth/services/auth.service.ts` (`admin.signed_in`), `apps/api/test/e2e/settings.e2e-spec.ts`, `apps/web/test/settings.test.tsx`

**Interfaces:**
- Produces:
  - `AUDIT_ACTION_LABELS: Record<AuditAction, string>` (plain English, for example `report.downloaded` → "Downloaded a PDF report")
  - `AuditLogQuerySchema { action?; from?; to?; page; pageSize ≤ 100 }`
  - `AuditLogItem { id; action; label; actorName: string|null; entityType; entityName: string|null; createdAt; ip: string|null; details: Record<string, string|number> }`. `entityName` is resolved for employees and reports. `details` holds whitelisted metadata only.
  - `GET /audit-logs` (OWNER/ADMIN), newest first

- [ ] **Step 1: Write the failing tests.**
  - API: after an admin login, an invite, a report download and a retention change, `GET /audit-logs` lists them with labels and actor names, newest first.
  - Filtering by `action=report.downloaded` gives one row.
  - Another company sees none of them.
  - Metadata keys outside the whitelist are not returned.
  - Web: the table renders the label, actor, date in IST and IP, and the empty state "Nothing recorded in this period."

  Run → FAIL.
- [ ] **Step 2: Implement.** Move `AuditAction` into `@worktrail/types` (`audit.ts`) so web and API share one list, and import it back in `audit.service.ts`.
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat: audit admin sign-ins and an audit log viewer"`

---

### Task 6: Admin support tools, deletion requests, export and erasure

**Files:**
- Create: `apps/api/src/modules/admin-tools/**`, `apps/api/src/modules/privacy/services/{deletion-requests,erasure,exports}.service.ts`, `apps/api/src/modules/privacy/controllers/{deletion-requests,exports,erase}.controller.ts`, `apps/api/test/e2e/{admin-tools,exports,erasure}.e2e-spec.ts`, `apps/web/src/app/app/employees/[id]/admin-actions.ts`, `apps/web/src/app/api/exports/[id]/download/route.ts`, `apps/web/src/components/employee-detail/{employee-actions-menu,erase-dialog}.tsx`, `apps/web/src/components/settings/deletion-requests.tsx`, `apps/web/test/employee-actions.test.tsx`, `apps/mobile/src/privacy/use-deletion-request.ts`
- Modify: the migration (`DeletionRequest`, `DataExport`, `Employee.deletedAt`), `jwt-auth.guard.ts`, `auth.service.ts`, `sessions.service.ts`, `employees.service.ts`, the `JobName`/router, the sweeper, `apps/mobile/src/app/(app)/profile.tsx`, `apps/mobile/src/api/client.ts`, `apps/web/src/lib/session.ts`

Prisma models:
```prisma
enum DeletionRequestStatus { OPEN DONE DISMISSED }
model DeletionRequest {
  id          String                @id @default(uuid()) @db.Uuid
  companyId   String                @map("company_id") @db.Uuid
  employeeId  String                @map("employee_id") @db.Uuid
  reason      String?               @db.VarChar(500)
  status      DeletionRequestStatus @default(OPEN)
  resolvedBy  String?               @map("resolved_by") @db.Uuid
  resolvedAt  DateTime?             @map("resolved_at") @db.Timestamptz
  note        String?               @db.VarChar(500)
  createdAt   DateTime              @default(now()) @map("created_at") @db.Timestamptz
  @@index([companyId, status])
  @@map("deletion_requests")
}

model DataExport {
  id                String       @id @default(uuid()) @db.Uuid
  companyId         String       @map("company_id") @db.Uuid
  employeeId        String       @map("employee_id") @db.Uuid
  requestedByUserId String       @map("requested_by_user_id") @db.Uuid
  status            ReportStatus @default(QUEUED)
  storageKey        String?      @map("storage_key")
  byteSize          Int?         @map("byte_size")
  failureReason     String?      @map("failure_reason")
  createdAt         DateTime     @default(now()) @map("created_at") @db.Timestamptz
  generatedAt       DateTime?    @map("generated_at") @db.Timestamptz
  expiresAt         DateTime?    @map("expires_at") @db.Timestamptz
  @@index([companyId, createdAt])
  @@map("data_exports")
}
```
(`DeletionRequest` and `DataExport` keep `employeeId` as a plain column without a foreign key, so erasing the employee's data never cascades into the record that it was requested or done.)

**Interfaces:**
- **Deactivate:** `POST /employees/:id/deactivate`
  - user `DISABLED`, all refresh tokens revoked, any `ACTIVE` session ended as `INCOMPLETE` at now;
  - audits `employee.deactivated` (plus `session.closed_by_admin` if one was open);
  - 409 if already deactivated; an invite-pending employee (no user) → 409 "This person hasn't joined yet. Revoke the invitation instead."
- **Reactivate:** `POST /employees/:id/reactivate` → `ACTIVE`, audited.
- **Password reset:** `POST /employees/:id/password-reset` → sends the Phase 1b reset email to the employee's account email and audits it. No email → 409 "This employee has no email address."
- **Deletion requests:**
  - `POST /me/deletion-request { reason? }` (employee) → 201. With one already open → 200 returning the same request.
  - `GET /deletion-requests` (admin).
  - `POST /deletion-requests/:id/dismiss { note }`.
  - Erasing the employee marks their open request `DONE`.
- **Exports:**
  - `POST /employees/:id/exports` → 202 `DataExportDto`, then a `privacy.export` job writes the ZIP. CSVs are streamed with `archiver`, and locations are read in pages of 5,000.
  - `GET /exports/:id`.
  - `GET /exports/:id/download`: same rules and headers as report download; audits `export.downloaded`.
  - Expiry 7 days.
- **Erasure:**
  - `POST /employees/:id/erase { confirmName }` → 202. `confirmName` must equal the employee's current name exactly, otherwise 400 "Type the employee's name exactly to confirm."
  - Audits `employee.erased` (requested) at once.
  - The `privacy.erase` job runs `ErasureService.erase(employeeId)`. It's idempotent: each step deletes whatever is left.
    1. Deactivate (as above).
    2. Delete storage files for their reports and exports, then the rows.
    3. Delete `generated_summaries`, `work_updates` and `location_points` (batched), then `work_sessions`.
    4. Delete `consent_records` and invitations for them.
    5. Anonymise `employees` (name "Deleted employee", email/phone/code null, `deletedAt`) and `users` (email `deleted+<id>@invalid`, name "Deleted employee", phone null, `passwordHash` set to an unusable random value).
    6. Mark open deletion requests `DONE`.
    7. Write a final `employee.erased` audit row with `{ completed: true, counts }`.
- **Auth:**
  - The login and refresh check for `DISABLED` → `401 ACCOUNT_DISABLED`.
  - The guard's 60-second cache is invalidated at once in the same process on deactivate.
  - The mobile client, on `ACCOUNT_DISABLED`: stops tracking, wipes the outbox and the secure store, and shows "This account has been turned off by your company."

- [ ] **Step 1: Write the failing tests.**
  - `admin-tools.e2e-spec.ts`:
    - deactivate during an active session → the session is `INCOMPLETE`, the employee's refresh fails with `ACCOUNT_DISABLED`, and their access token fails within the cache window (test with the cache set to 0 ms via env);
    - reactivate → they can sign in;
    - reset link → one outbox mail;
    - another company → 404 on all three.
  - `exports.e2e-spec.ts`:
    - the export becomes `READY`;
    - downloading gives `application/zip` containing `sessions.csv`, `locations.csv`, `updates.csv` and `README.txt` with the right row counts and header rows;
    - CSV injection is neutralised (an update starting with `=SUM(` is written as `'=SUM(`);
    - expired → 410;
    - another company → 404;
    - audit rows exist.
  - `erasure.e2e-spec.ts`:
    - a seeded employee with sessions, points, updates, summaries, a READY report file, an export file, consent and an open deletion request;
    - a wrong `confirmName` → 400;
    - the right name → 202, then after the job settles: zero rows in every listed table for that employee id, the files are gone from storage, the employee row is anonymised and hidden from `GET /employees`, `GET /employees/:id` → 404, the request is `DONE`, the audit rows remain and contain no name or text;
    - running erase twice is harmless;
    - another company's admin → 404.
  - Web `employee-actions.test.tsx`:
    - the menu shows Deactivate or Reactivate depending on state;
    - the erase dialog keeps **Delete permanently** disabled until the typed name matches, and lists what will be deleted and what is kept;
    - export shows "Preparing…" and then a download link.
  - Mobile: Profile → Privacy → **Ask my company to delete my data** → confirm → "Request sent. Your company will contact you." A second tap shows "You already asked on 7 Oct."

  Run → FAIL.
- [ ] **Step 2: Implement** as specified. Reuse the Phase 6 queue, storage, BFF download route and `AutoRefresh`. The Privacy & data settings tab lists open deletion requests with **Open employee** and **Dismiss** (with a note).
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` → PASS.
- [ ] **Step 4: Commit.** `git commit -m "feat: deactivate, reset link, data export, deletion requests and erasure"`

---

### Task 7: Ops script to erase a whole company (pilot exits)

**Files:**
- Create: `apps/api/scripts/erase-company.ts`, `apps/api/test/e2e/erase-company.e2e-spec.ts`
- Modify: `apps/api/package.json` (`ops:erase-company`)

- [ ] **Step 1: Write the failing test.** Running the script's exported `eraseCompany(prisma, storage, companyId, { confirm: companyName })`:
  - with a wrong name throws;
  - with the right name runs `ErasureService` for each employee, then deletes reports, exports, summaries, invitations, refresh tokens and users, and finally sets the company's name to "Deleted company" and retention to 30;
  - keeps `audit_logs`, plus one `company.erased` row with counts;
  - leaves the other company untouched.

  Run → FAIL.
- [ ] **Step 2: Implement.**
  - CLI: `pnpm --filter @worktrail/api ops:erase-company -- --company <id> --confirm "<exact name>"`.
  - It prints counts and asks "Type ERASE to continue" on stdin unless `--yes` is given.
  - Documented in `docs/production.md` as a support procedure needing the customer's written request.
- [ ] **Step 3: Run the tests and confirm they pass.**
- [ ] **Step 4: Commit.** `git commit -m "feat(ops): erase a whole company on request"`

---

### Task 8: S3-compatible storage, Docker image and CI

**Files:**
- Create: `apps/api/src/common/storage/s3.storage.ts`, `apps/api/test/unit/s3-storage.spec.ts`, `apps/api/Dockerfile`, `apps/api/.dockerignore`, `.github/workflows/ci.yml`, `.github/workflows/secrets.yml`, `apps/mobile/eas.json`, `apps/mobile/app.config.ts`
- Modify: `apps/api/src/common/storage/storage.module.ts`, `apps/api/src/modules/health/*`, `apps/api/src/config/env.ts`, `.env.example`

**Interfaces:**
- Produces:
  - `S3Storage implements FileStorage`: `PutObject` with `ServerSideEncryption: 'AES256'` where supported, `GetObject` body as a stream, `DeleteObject`, and `forcePathStyle` for R2 or MinIO;
  - `GET /health/ready` → 200 `{ db: 'up', redis: 'up'|'disabled' }` or 503.

- [ ] **Step 1: Write the failing tests.**
  - `s3-storage.spec.ts`: with `aws-sdk-client-mock`, `put`/`stream`/`remove` call the right commands with the bucket and key, a missing key maps `NoSuchKey` → `AppError(404)`, and key validation matches `LocalStorage`.
  - In the health e2e: `/health/ready` returns 200 with the database up, and `redis: 'disabled'` in inline mode.

  Run → FAIL.
- [ ] **Step 2: Implement.**
  - **`Dockerfile`** (multi-stage, `node:22-slim`):
    - deps with `pnpm fetch` + `pnpm install --offline --frozen-lockfile --filter @worktrail/api...`;
    - build the types and the API;
    - `pnpm deploy --filter @worktrail/api --prod /out`;
    - runtime installs Chromium with `npx playwright install --with-deps chromium`;
    - a non-root `node` user;
    - `CMD ["node","dist/main.js"]`;
    - the worker runs the same image with `node dist/worker.js`;
    - migrations run as a release command: `npx prisma migrate deploy`.

    Build it once locally to check it, and ledger the image size.
  - **`ci.yml`** (on push and PR):
    - Node 22, pnpm cache;
    - services `postgis/postgis:16-3.4` and `redis:7-alpine`;
    - `pnpm install --frozen-lockfile`;
    - `pnpm lint`, `pnpm typecheck`;
    - `pnpm --filter @worktrail/api db:test:migrate`;
    - `pnpm test`;
    - `pnpm build` (the web build uses dummy public env).

    Playwright Chromium is installed only for the API job, cached.
  - **`secrets.yml`:** `gitleaks/gitleaks-action` on push and PR. Run `gitleaks detect` over the **full history** once locally and record the result in the ledger. If it finds anything real (for example the old ProMap commits), stop and tell the user. Rewriting history needs their approval.
  - **`eas.json`:**
    - `development` (dev client, cleartext allowed);
    - `preview` (internal APK for the pilot, cleartext off, `EXPO_PUBLIC_API_URL` set to production);
    - `production` (AAB for Play, later).
  - **`app.config.ts`** reads `EAS_BUILD_PROFILE` to set `usesCleartextTraffic` and the Sentry plugin options.
- [ ] **Step 3: Run the tests and confirm they pass.** `pnpm test` → PASS. Push the branch only if the user approves (Open Question 6), then check that CI goes green.
- [ ] **Step 4: Commit.** `git commit -m "build: S3 storage driver, API/worker image, CI and secret scanning"`

---

### Task 9: Production environment, backups and restore drill

**Files:**
- Create: `infra/backup/{backup.sh, restore.sh, README.md}`, `docs/production.md`
- Modify: `README.md`

**This task touches real accounts and costs money. Each external step needs the user's explicit go-ahead in chat**: creating projects, entering billing, setting secrets, deploying, pointing DNS. Prepare everything and stop at each of those points.

- [ ] **Step 1: Write `docs/production.md`** with the layout chosen in Open Question 1 (default below). It covers the environment variable table (which are secrets), deploy steps, running migrations, scaling the worker, rotating `JWT_ACCESS_SECRET`, rolling back to the previous image, and what to check when the dashboard is slow or summaries stop arriving.

  Default layout:

  | Part | Where |
  |---|---|
  | Web | Vercel (Mumbai region `bom1`) |
  | API + worker | Railway (two services from one image), Singapore/Asia region |
  | Postgres 16 + PostGIS | Railway |
  | Redis | Railway |
  | Files (PDFs, exports) | Cloudflare R2 private bucket |
  | Backups | A second R2 bucket with a different key, or Backblaze B2 |
  | Error tracking | Sentry (free tier) |
  | Uptime | Better Stack or UptimeRobot on `/api/v1/health/ready` and the web `/login` |
  | Mail | The transactional mail provider chosen with the user (Phase 1b `Mailer`; Resend by default) |

- [ ] **Step 2: Write the backup scripts.**
  - `backup.sh`:
    - `pg_dump --format=custom` → gzip → encrypt with `age` to a public key (the private key stays offline with the user);
    - upload to the backup bucket as `daily/YYYY-MM-DD.dump.age`;
    - on the 1st of the month also `monthly/YYYY-MM.dump.age`;
    - delete dailies older than 30 days and monthlies older than 12;
    - exit non-zero on any failure, so the scheduler alerts.
  - It runs as a Railway cron service (or GitHub Actions schedule) at 03:00 IST.
  - `restore.sh <object>`: download → decrypt → `pg_restore` into a **new scratch database** → print row counts for `companies, employees, work_sessions, location_points, work_updates, audit_logs`. It never restores over production. Overwriting production is a manual, documented, two-person step.
- [ ] **Step 3: Restore drill** (after the user approves creating the environment). Run one backup, restore it into a scratch database, compare the counts with production, and record the date, the counts and the minutes taken in `infra/backup/README.md`. Repeat monthly during the pilot (checklist item in the playbook).
- [ ] **Step 4: Smoke test production** (after approval). Sign up a throwaway company, invite yourself as an employee, use a preview APK to start work, wait for 2 points, send an update, end work, check the summary, download a PDF, export, erase the employee and erase the company with the ops script. Record it in `docs/production.md`.
- [ ] **Step 5: Commit** the scripts and docs (never keys): `git commit -m "docs(ops): production layout, encrypted backups and restore drill"`

---

### Task 10: Android device test matrix (physical phones)

**Files:**
- Modify: `docs/device-test-android.md`

This is manual testing on real phones, done by the user or their team with the `preview` APK from Task 8. The executor prepares the sheet, helps interpret results and fixes bugs found (each with a failing test first).

- [ ] **Step 1: Rewrite the document** as a matrix. Rows are scenarios, columns are phones, and each cell holds the observed result, the point count and notes.
  - **Phones** (the brands most common with Indian field staff; borrow if needed):
    - Xiaomi/Redmi (HyperOS/MIUI)
    - Samsung (One UI, an A-series)
    - Realme or Oppo (ColorOS)
    - Vivo (Funtouch/OriginOS)
    - Motorola or a Pixel (near-stock baseline)
    - At least one phone with ≤ 4 GB RAM on Android 10 or 11
  - **Scenarios:**
    - the 11 from Phase 3 and the Phase 4 voice checks;
    - consent first run and a version bump;
    - a deactivated account mid-shift (tracking stops, data wiped);
    - battery under 15% with battery saver auto-on;
    - an 8-hour shift's battery use;
    - an app update installed mid-shift;
    - a phone restart mid-shift;
    - the brand's own "auto-start" or "app launch" setting **off** vs **on**.
  - **Record:** phone model, Android and skin version, app version, the session id and the SQL counts (queries already in the doc).
  - Remove the current "Observed" text written from the code's intent. Only real observations go in.
- [ ] **Step 2: Turn each brand-specific fix into code or copy.** For example, if Xiaomi stops tracking without "Autostart", add a brand-aware tip on the permissions screen that opens that setting, using `expo-intent-launcher` with a fallback to app settings. Each change needs a test.
- [ ] **Step 3: Sign-off table** at the top: per brand, whether 5-minute capture worked screen-off for 30 min (Y/N), whether offline catch-up worked (Y/N), battery % per hour, and known limits. PRD §10 needs at least one phone that passes. The pilot should have each pilot company's main brand passing.
- [ ] **Step 4: Commit.** `git commit -m "docs: Android device matrix with observed results"`

---

### Task 11: Definition-of-done sweep

**Files:** whatever the sweep finds; each fix gets a test first.

- [ ] **Step 1: Run the checks.**
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build` are all clean.
  - The authorisation matrix (Task 2) is green.
  - `gitleaks detect` (full history) is clean, or its findings were reported to the user.
- [ ] **Step 2: UI states pass.** For every web page and mobile screen, confirm and tick a table in the ledger: loading, empty, success, and failure (API down, 403 and 404). Use the browser for web at 1440×900 and 390×844, and the emulator or phone for mobile.
- [ ] **Step 3: Accessibility pass on the web.**
  - Keyboard-only through login, invite, employee page tabs, the close-session dialog, the erase dialog and settings.
  - Focus is visible.
  - Dialogs trap focus and close with Esc.
  - Colour contrast of the orange text tokens (plan.md Open Question 14).
- [ ] **Step 4: Performance check against PRD §8** on production-like data. Seed 25 employees × 30 days and time:
  - the dashboard (< 1.5 s server time);
  - a month's trail (< 2 s);
  - a month's PDF (< 30 s);
  - 50 updates summarised (90% within 60 s with the real AI).

  Record the results.
- [ ] **Step 5: Commit** any fixes: `git commit -m "fix: definition-of-done sweep"`

---

### Task 12: Pilot playbook and metrics

**Files:**
- Create: `docs/pilot-playbook.md`, `apps/api/scripts/pilot-metrics.ts`, `apps/api/test/e2e/pilot-metrics.e2e-spec.ts`
- Modify: `apps/api/package.json` (`ops:pilot-metrics`)

**Interfaces:**
- Produces: `pilotMetrics(prisma, { from, to }) → Array<{ company; activeEmployees; firstPointWithin2MinPct; workdaysWithUpdatePct; summariesWithin60sPct; reportP95Seconds; activeWeeks: number[] }>`. The values map to PRD §8:
  - **≥ 80%** of sessions get their first location within 2 min of start;
  - **≥ 70%** of active workdays have an update;
  - **≥ 90%** of summaries within 60 s (`summaryGeneratedAt - submittedAt`);
  - monthly reports **< 30 s** (`generatedAt - createdAt`);
  - "uses it in a week" = at least one admin sign-in and at least 3 employee sessions that week.

- [ ] **Step 1: Write the failing test.** Seed known data and assert each percentage, including the edge cases: zero sessions (shown as "n/a", not 0%), a session with no points, an update still queued (excluded from the 60 s metric but counted as "pending").
- [ ] **Step 2: Implement.** CLI: `pnpm --filter @worktrail/api ops:pilot-metrics -- --from 2026-11-01 --to 2026-11-28`. It prints a table and writes `pilot-metrics-<date>.csv` to the current folder (git-ignored).
- [ ] **Step 3: Write `docs/pilot-playbook.md`.**
  - **Gate before day 1 (all must be ticked):**
    - the privacy notice reviewed by a lawyer, or the user has explicitly waived it in writing for the pilot;
    - production smoke test passed;
    - restore drill done;
    - each company's main phone brand passes the device matrix;
    - support phone or WhatsApp number decided;
    - each company has signed a short pilot agreement (template outline in the doc; the user supplies the legal text).
  - **Choosing 5 companies:**
    - 5–30 field staff;
    - Android phones;
    - an owner who will look at the dashboard weekly;
    - a mix of sales, service and delivery work.
  - **Onboarding (45-minute call script):**
    - admin signup;
    - invite 2 staff live;
    - install the APK (the Play Store internal testing link once ready);
    - the privacy notice read aloud with staff;
    - battery and autostart settings per brand (from Task 10);
    - first Start work together;
    - the first update by voice.
  - **Weeks 1–4 routine:**
    - **daily:** Sentry and uptime check, and the queue backlog (`QUEUED` older than 5 min);
    - **twice a week:** WhatsApp check-in with each admin;
    - **weekly:** `ops:pilot-metrics`, review the numbers against targets, and log feedback in a table (company, date, issue, severity, decision);
    - **monthly:** the restore drill.
  - **Support playbook:** "points missing" (check the brand settings, the matrix row, the outbox count on the phone), "summary unavailable" (check the worker, the AI key, the failure reason), "employee left the company" (deactivate, then erase if asked), "company wants to leave" (export each employee, then `ops:erase-company` with a written request).
  - **Exit criteria:** PRD §8 pilot metric, "3 of 5 pilot companies actively use the product for four consecutive weeks", plus the four product targets above. Write a one-page result: what worked, what didn't, the decision on a broad launch.
- [ ] **Step 4: Commit.** `git commit -m "docs: pilot playbook and success-metrics script"`

---

## Open Questions (each has a default; tell me if any is wrong)

1. **Hosting.** *Default: web on Vercel; API, worker, Postgres+PostGIS and Redis on Railway; files and backups on Cloudflare R2 (two buckets, separate keys); Sentry free tier; uptime on Better Stack.* That's roughly ₹2,000–4,000 a month for the pilot. Other options: Render or Fly.io for the API; Neon (has PostGIS) for Postgres; AWS Mumbai for everything if a customer requires data in India. Do any pilot customers need data stored in India?
2. **Default retention.** *Default: 90 days for precise locations (the PRD's recommendation), adjustable from 30 to 365 per company. Work hours and updates are kept until erasure.* Should updates also have a retention limit?
3. **More than one admin per company.** *Default: not in the MVP. The owner is the only admin, and "role changes" are reserved in the audit log.* Do pilot companies need a second admin (for example a manager)? That's a small extra task: invite admin, change role, audited.
4. **Erasure.** *Default: an admin can permanently erase an employee's data after typing their name. It happens at once, with no 30-day grace period.* Do you want a grace period during which it can be cancelled?
5. **Notice language.** *Default: English only for the pilot, with the notice text kept in one file for an easy Hindi version.* Should the employee app's privacy notice also be in Hindi from day one?
6. **GitHub.** *Default: CI runs on GitHub Actions, which needs the branches pushed.* `origin` still points at `punnoose-creator/Pro-Map` (plan.md Open Question 13). May I push `work-trail/*` branches there, or should we create a new `work-trail` repository first? I won't push without your yes.
7. **Legal review.** *Default: the pilot gate requires the privacy notice to be reviewed by a lawyer familiar with India's Digital Personal Data Protection Act 2023, or a written waiver from you for the pilot.* Do you have someone, or should the playbook keep it as a must-do before broad launch only?
8. **Play Store.** *Default: the pilot uses an internal APK (EAS `preview`), and the Play Store listing comes after the pilot.* Google reviews background-location apps strictly: it needs a prominent disclosure (done in Task 3), a privacy policy URL and a demo video. Should the Play Store submission start during the pilot?
