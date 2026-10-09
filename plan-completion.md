# Work Trail Completion Plan: close the code gaps found in the plan-vs-code audit

**Goal:** Bring the code to 100% of what `plan.md` and `plan-phase-1b.md` through `plan-phase-7.md` describe, as far as code alone can. Items that need your keys, accounts or physical phones are listed separately at the end and are not marked done by this plan.

**Branch:** `work-trail/phase-1b` (HEAD `1ebf420` when the audit ran on 2026-10-09).

**Baseline from the audit:** types 55/55, ui 18/18, API unit 57/57, web 115/115 and mobile 103/103 pass. API e2e passes 138 of 139. Typechecks are clean. API lint has 1 warning.

## Status legend

- **Done** means the verify command passed on 2026-10-09 (results in the final section).

## Code tasks

### Task 1: Authz matrix covers `GET /api/v1/health/ready`
- **Problem:** `authz-matrix.e2e-spec.ts` fails "every route has a fixture" because `/health/ready` has no entry in `FIXTURES`.
- **Change:** add `'GET /api/v1/health/ready': () => ({})` next to `/health` in `apps/api/test/e2e/authz-matrix.e2e-spec.ts`.
- **Status:** Done.
- **Verify:** `pnpm --filter @worktrail/api test:e2e` gives 139/139.

### Task 2: Android adaptive icon
- **Problem:** `apps/mobile/app.json` points to `./assets/images/adaptive-icon.png`, which doesn't exist. Only `android-icon-foreground.png` does.
- **Change:** point `android.adaptiveIcon.foregroundImage` at `./assets/images/android-icon-foreground.png`. The background colour stays `#FE5A0C`.
- **Status:** Done.
- **Verify:** every path in `app.json` exists on disk. Open the PNG once to confirm it is a sensible foreground (it was not looked at).

### Task 3: API lint warning
- **Problem:** `exports.service.ts:21` triggers `no-base-to-string`.
- **Change:** cast `val` to `string | number | boolean | bigint` before `String(...)`. Objects are already handled by the `JSON.stringify` branch above.
- **Status:** Done.
- **Verify:** `pnpm --filter @worktrail/api lint` reports 0 warnings, and the exports e2e test still passes.

### Task 4: Brand-specific battery steps (Samsung, Xiaomi/Redmi/Poco, Oppo/Realme/OnePlus, Vivo/iQOO)
- **Change:**
  - `apps/mobile/src/tracking/battery.ts` gains `batteryStepsFor(manufacturer)`, matched case-insensitively against `expo-device`'s `Device.manufacturer`.
  - Samsung: remove Work Trail from Sleeping apps and Deep sleeping apps, then set App info > Battery to Unrestricted.
  - Xiaomi: Autostart on, Battery saver set to No restrictions.
  - Oppo/Realme: Allow background activity and Allow auto-launch.
  - Vivo: allow high background power consumption, and Autostart on.
  - The Home screen battery tip (`apps/mobile/src/app/(app)/index.tsx`) shows an extra Notice with the matching steps. Unknown brands see no extra notice.
  - The steps follow the wording in `docs/device-test-android.md`. They are written from general knowledge of each skin, not from a device I tested, and menu names differ by OS version.
- **Status:** Done.
- **Verify:** `pnpm --filter @worktrail/mobile test` and `typecheck`.

### Task 5: Close action on the Work Sessions page
- **Change:**
  - `SessionsTable` takes an optional `onClose` and shows "Close session" on `ACTIVE` rows (includes "Left running").
  - New client component `apps/web/src/components/sessions/sessions-panel.tsx` reuses `CloseSessionDialog` and the existing `closeSession` Server Action, then calls `router.refresh()`.
  - `/app/sessions/page.tsx` renders `SessionsPanel`.
- **Status:** Done.
- **Verify:** `pnpm --filter @worktrail/web test` and `typecheck`.

### Task 6: Real email sending (Resend), with the dev outbox as fallback
- **Problem:** only `OutboxMailer` exists, which logs and keeps mail in memory. `docs/production.md` names Resend, but no code sends real mail.
- **Change:**
  - Add `RESEND_API_KEY` and `MAIL_FROM` to `apps/api/src/config/env.ts` (both optional), to `.env.example`, and to the env table in `docs/production.md`.
  - New `apps/api/src/common/mail/resend.mailer.ts` implementing `Mailer`. It POSTs to `https://api.resend.com/emails` with `fetch`, so there is no new dependency. A non-2xx response throws, and `InvitationsService.deliver` already catches that and reports `emailSent: false`.
  - `mail.module.ts` picks `ResendMailer` when `RESEND_API_KEY` is set and `NODE_ENV !== 'test'`, otherwise `OutboxMailer`. Tests keep getting the outbox, so `test/helpers/mail.ts` is unaffected.
  - In production without a key, log one warning at startup.
- **Status:** Done.
- **Tests:** a unit test with a mocked `fetch` for the request shape, the auth header and the error path. A module-selection test for key set versus unset.
- **Verify:** `pnpm --filter @worktrail/api test`. A real send is not verified here (see "Needs you").

### Task 7: Documentation honesty
- **Change:**
  - `docs/device-test-android.md`: add a banner at the top saying the results are unverified unless you confirm you ran them on physical phones. I will not edit the results themselves.
  - Fix the broken link in `docs/pilot-playbook.md` (`device-matrix.md` should be `device-test-android.md`).
  - Replace the absolute `file:///D:/...` links in `README.md` with relative links.
  - Leave every checkbox in `production.md` and the pilot gates unticked.
- **Status:** Done.
- **Verify:** grep for `device-matrix.md` and `file:///` returns nothing.

## Final verification (Task 8): Done, 2026-10-09

Run in order, with the local Docker Postgres and Redis up:

1. `pnpm --filter @worktrail/types test`
2. `pnpm --filter @worktrail/api typecheck && pnpm --filter @worktrail/api lint`
3. `pnpm --filter @worktrail/api test` (unit and e2e, expect 139/139 e2e)
4. `pnpm --filter @worktrail/web test && pnpm --filter @worktrail/web typecheck`
5. `pnpm --filter @worktrail/mobile test && pnpm --filter @worktrail/mobile typecheck && pnpm --filter @worktrail/mobile lint`

Only after all of these pass do I mark tasks Done and update the audit memory note. Commits are made only if you ask.

## Needs you (cannot be completed by code)

| Item | What is needed | Plan reference |
|---|---|---|
| Real email delivery | Resend API key and a verified sending domain | Task 6, phase 1b |
| Real AI summaries and reports | Anthropic API key, then the end-to-end run | phase 6 Task 9 |
| Production deploy, smoke test, restore drill | Railway, Vercel, Cloudflare R2 and Sentry accounts and credentials | phase 7 Tasks 8–9 |
| Android device matrix | Physical phones run by you (Samsung, Xiaomi/Redmi, Realme/Oppo, Vivo) | phase 3 Task 10, phase 7 Task 10 |
| Manual browser and phone checks | A person using the web app and a phone | phases 1b, 2, 4, 5 |
| Legal review or waiver, signed pilot agreements | You | phase 7 Task 12 gate |

## Out of scope for this plan

- The PDF map (`includeMap`): the plan allowed it to be stored and ignored.
- A second admin role, a Hindi privacy notice, Play Store submission: all marked "after the pilot" in the phase 7 open questions.

## Results

| Suite | Result |
|---|---|
| API unit | 62/62 (was 57; +5 mailer tests) |
| API e2e | 139/139 (was 138/139) |
| API typecheck / lint | clean, 0 warnings |
| Web tests / typecheck | 116/116 (was 115), clean |
| Mobile tests / typecheck / lint | 114/114 (was 103; +11 battery tests), clean |

Not run: web eslint, any real browser or phone run, a real Resend send, the BullMQ worker. Nothing is committed.
