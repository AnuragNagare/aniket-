# WorkTrail Pilot Playbook

Operational guide for running the 4-week pilot with 5 companies under India's Digital Personal Data Protection Act 2023 (DPDP Act) and PRD §8 requirements.

---

## 1. Gate Before Day 1 (Checklist)

Every box must be signed off before any field employee installs the WorkTrail app or begins tracking.

- [ ] **Privacy Notice Legal Review / Waiver**
  - Notice complies with DPDP Act 2023 notice provisions and PRD §7 privacy requirements.
  - Signed off by legal counsel, OR explicit written pilot waiver from WorkTrail leadership on file.
- [ ] **Production Smoke Test Passed**
  - Full flow tested on production infrastructure: signup, employee invite, login, consent prompt, 30 min tracking, voice update, AI summary generation, monthly report generation, data export, employee erasure, and `ops:erase-company`.
  - Documented with timestamps in [`docs/production.md`](file:///D:/Git%20hub%20project/Work%20Trail/docs/production.md).
- [ ] **Database Restore Drill Completed**
  - Encrypted backup created and restored to an isolated scratch database.
  - Row counts matched production. Documented in [`infra/backup/README.md`](file:///D:/Git%20hub%20project/Work%20Trail/infra/backup/README.md).
- [ ] **Android Device Matrix Sign-Off**
  - Each pilot company's primary device brands (Samsung, Xiaomi/Redmi, Realme, Vivo, OnePlus) verified against [`docs/device-matrix.md`](file:///D:/Git%20hub%20project/Work%20Trail/docs/device-matrix.md).
  - Power management / background autostart bypass instructions confirmed for their specific OS versions.
- [ ] **Support Channel Live**
  - Dedicated WhatsApp Business / phone support number and support email established and manned during pilot business hours (08:00–20:00 IST).
- [ ] **Signed Pilot Agreement on File**
  - Agreement executed with each participating company covering pilot duration (4 weeks), data controller/processor roles, voluntary consent, and data erasure guarantees upon request.

### Pilot Agreement Outline (Template)

```text
WORKTRAIL PILOT PARTICIPATION AGREEMENT (SUMMARY OF TERMS)
1. Parties: [Company Name] ("Company", Data Fiduciary) and WorkTrail ("Provider", Data Processor).
2. Purpose & Duration: 4-week evaluation of WorkTrail field tracking and automated reporting.
3. Employee Protection:
   - Tracking occurs strictly during active work sessions initiated by the employee.
   - Background tracking stops immediately when "End Work" is tapped.
   - Employees are shown the DPDP-compliant Privacy Notice and must explicitly consent before first session.
   - Field staff may request erasure of their personal location records at any time.
4. Data Retention & Erasure:
   - High-precision GPS locations purged after the company retention window (default 90 days, or immediately on company exit).
   - Upon pilot termination or written request, all company data will be erased within 7 days via automated cryptographic erasure script.
5. Support & Feedback: Company designates an active administrator to review reports weekly and attend a weekly 15-minute feedback debrief.
```

---

## 2. Selecting the 5 Pilot Companies

Selection criteria ensure realistic operational feedback across diverse field environments:

| Criterion | Requirement | Rationale |
|---|---|---|
| **Staff Size** | 5 to 30 active field staff | Large enough for statistical significance; small enough for white-glove onboarding. |
| **Device Ecosystem** | Android 10+ (Samsung, Xiaomi, Vivo, Realme, OnePlus) | Covers 95%+ of the Indian enterprise field workforce. |
| **Owner Commitment** | Owner/Operations Lead commits to checking dashboard ≥ 1x/week | Ensures active operational evaluation and administrative feedback. |
| **Field Mix** | Sales (intermittent stops), Field Service (extended visits), Local Delivery (continuous movement) | Validates diverse movement patterns, stationary geofencing, and battery impact across varied usage profiles. |

---

## 3. Onboarding Script (45-Minute Live Call)

Conduct a live video or on-site session with the company owner and at least 2 field team members.

### Timeline & Checklist

#### 00:00–00:10 — Company Admin Setup
1. Admin opens WorkTrail Web Dashboard (`https://app.worktrail.in` or pilot URL).
2. Admin completes signup: Name, Work Email, Company Name, Industry.
3. Verify initial settings in **Settings → Company & Privacy**:
   - Confirm company location retention period (default: 90 days).
   - Confirm timezone is `Asia/Kolkata`.

#### 00:10–00:20 — Inviting Staff & Installing App
1. In **Employees**, admin clicks **Add Employee**.
2. Enter Name, Phone Number, and Optional Email for 2 test field workers.
3. Workers receive the invitation SMS/WhatsApp link containing the app download link (Preview APK / internal Play Store testing track).
4. Guide workers through downloading and launching the WorkTrail mobile app.
5. Workers log in using their registered mobile number and SMS OTP.

#### 00:20–00:30 — Privacy Notice & Permissions (Read Aloud)
> **Crucial Compliance Step:** Do not rush through the privacy disclosure screen.
1. Read the on-screen DPDP Privacy Notice aloud together:
   - *"WorkTrail only records your location while you tap 'Start Work'. When you tap 'End Work', all tracking immediately turns off."*
   - *"Your company retains location trails for 90 days. You can view your history and request data erasure from your profile."*
2. Tap **I Understand & Agree** (consent is cryptographically recorded with timestamp and version).
3. Grant Android Location Permission: select **"While using the app"**, followed by system prompt for **"Allow all the time"** (Background location).
4. Grant Notification permission (required for foreground tracking service).

#### 00:30–00:40 — OEM Battery & Autostart Optimization
Walk each employee through their brand-specific settings (refer to [`docs/device-matrix.md`](file:///D:/Git%20hub%20project/Work%20Trail/docs/device-matrix.md)):
- **Xiaomi / Redmi / POCO (MIUI / HyperOS):**
  - Settings → Apps → Manage Apps → WorkTrail → Enable **Autostart**.
  - Battery Saver → Set to **No restrictions**.
- **Samsung (One UI):**
  - Settings → Apps → WorkTrail → Battery → Set to **Unrestricted**.
  - Settings → Battery & Device Care → Background usage limits → Add WorkTrail to **Never sleeping apps**.
- **Realme / OPPO (ColorOS / Realme UI):**
  - App Info → Battery usage → Enable **Allow background activity** & **Allow auto-launch**.
- **Vivo (Funtouch OS):**
  - Settings → Battery → High background power consumption → Enable for WorkTrail.
  - App Manager → Autostart → Enable WorkTrail.
- **OnePlus (OxygenOS):**
  - App Info → Battery usage → Enable **Allow background activity**.

#### 00:40–00:45 — Live Test Session & First Voice Update
1. Worker taps green **Start Work** button. Confirm persistent tracking notification appears.
2. Worker taps **Add Update** → taps microphone icon and speaks a quick note:
   - *"Arrived at customer site ABC Corp for scheduled equipment maintenance."*
3. Worker taps **Submit**. Confirm speech-to-text transcription displays in update feed.
4. Verify on Admin Dashboard: worker's active status appears on live map with battery indicator and first update within 2 minutes.

---

## 4. Weeks 1–4 Operational Routine

### Daily Checklist (Ops / Engineering)
- [ ] **Sentry Dashboard Check:** Review error rate, scrubbed PII, unhandled exceptions in mobile app and API.
- [ ] **Queue Backlog Check:** Verify BullMQ / database queue status:
  - No `QUEUED` AI summary jobs older than 5 minutes.
  - No `QUEUED` PDF report generation jobs older than 5 minutes.
- [ ] **Uptime & Health Status:** Review `/api/v1/health/ready` probe metrics on monitoring dashboard.

### Twice-Weekly Routine (Customer Success)
- [ ] **WhatsApp Check-in:** Message each pilot admin on Tuesday and Thursday:
  - *"How did today's field trails look? Did everyone remember to End Work? Any questions from the team?"*
  - Address missing points or confusing UI immediately.

### Weekly Routine (Every Friday Afternoon)
- [ ] **Run Pilot Metrics Script:**
  ```bash
  pnpm --filter @worktrail/api ops:pilot-metrics -- --from 2026-11-01 --to 2026-11-07
  ```
- [ ] **Review Target Benchmarks against PRD §8:**
  - First point latency within 2 min: Target ≥ 80%
  - Workdays with updates: Target ≥ 70%
  - AI summaries within 60s: Target ≥ 90%
  - Monthly report generation: Target < 30s
  - Weekly active threshold: ≥ 1 admin login + ≥ 3 employee sessions
- [ ] **Log Feedback in Pilot Register:** Record any bugs, friction points, or feature requests.

#### Weekly Feedback Register Template

| Company | Date | Issue / Feedback | Severity | Decision / Action |
|---|---|---|---|---|
| ABC Logistics | 2026-11-04 | Vivo phone killed service after 2h screen-off | High | Configured Funtouch High Power Consumption; updated onboarding checklist. |
| Speed Fasteners | 2026-11-05 | Hindi speech in noisy street missed 2 words | Medium | Recommended holding phone closer; logged whisper model prompt tuning. |

### Monthly Routine
- [ ] **Run Backup & Restore Drill:** Follow [`infra/backup/README.md`](file:///D:/Git%20hub%20project/Work%20Trail/infra/backup/README.md) to restore production database backup into an isolated scratch instance, verify record counts, and document drill duration.

---

## 5. Support Playbook

### Scenario A: "Points are Missing / Trail has Straight Lines"
1. Check employee's device model in Admin dashboard or device register.
2. Check battery optimization settings:
   - Did the user restart their phone? (On MIUI/ColorOS, autostart permission is required to resume after reboot).
   - Was battery saver enabled when battery dropped below 20%?
3. Check phone outbox count:
   - Ask employee to open WorkTrail → Profile → check **Sync status**. If points are pending, they will upload once connectivity stabilizes.
4. Verify GPS permissions: confirm location access is still set to "Allow all the time".

### Scenario B: "Summary Unavailable / Delayed"
1. In API logs, inspect `generated_summaries` where `status = 'FAILED'`.
2. Check LLM provider error message / API rate limits or quota balance.
3. Check worker service logs: verify `work-summary.processor.ts` is running and consuming BullMQ jobs.
4. If failed, trigger manual retry via ops queue or API endpoint.

### Scenario C: "Employee Left the Company"
1. Admin navigates to **Employees → [Employee Name]**.
2. Click **Deactivate Employee**:
   - Immediately revokes all active JWT refresh tokens.
   - Terminates any active tracking session as `INCOMPLETE`.
   - Employee mobile app clears secure token store and displays "Account deactivated".
3. If employee or company submits a formal erasure request:
   - Navigate to **Employees → [Employee Name] → Erase Data**.
   - Admin types employee's full name to confirm.
   - Anonymizes employee and user records, deletes location points, audio files, summaries, and audit entries referencing personal details.

### Scenario D: "Company Wants to Conclude Pilot / Erase All Data"
1. Generate complete data export for the company:
   - For each employee, generate ZIP export (`sessions.csv`, `locations.csv`, `updates.csv`).
   - Admin downloads ZIP files before exit.
2. Execute company-wide erasure script with written authorization:
   ```bash
   pnpm --filter @worktrail/api ops:erase-company -- --company <company-id> --confirm "<Company Name>" --yes
   ```
3. Script cascades erasure across all company employees, work sessions, points, summaries, reports, invitations, and file storage.
4. Issues cryptographically signed Erasure Certificate with record counts and timestamp.

---

## 6. Pilot Exit Criteria & Evaluation (PRD §8)

At the conclusion of the 4-week pilot, evaluate success against the strict PRD §8 benchmarks:

### Quantitative Target Scorecard

| Metric | Target | Measurement Method | Pilot Result | Status |
|---|---|---|---|---|
| **Sustained Adoption** | **≥ 3 of 5 companies** active 4 consecutive weeks | ≥ 1 admin sign-in + ≥ 3 employee sessions every single week | Measured via `ops:pilot-metrics` | TBD |
| **Location Promptness** | **≥ 80%** of sessions get first point within 2 min | `first_point_time - session_start_time <= 120s` | Measured via `ops:pilot-metrics` | TBD |
| **Field Engagement** | **≥ 70%** of active workdays have ≥ 1 update | `days_with_update / total_active_workdays` | Measured via `ops:pilot-metrics` | TBD |
| **AI Summary Latency** | **≥ 90%** of summaries generated within 60s | `summary_generated_at - submitted_at <= 60s` | Measured via `ops:pilot-metrics` | TBD |
| **PDF Report Latency** | **< 30s** p95 for monthly PDF report generation | `report_ready_at - report_created_at <= 30s` | Measured via `ops:pilot-metrics` | TBD |

### Pilot Evaluation One-Pager (To be completed post-pilot)

```text
WORKTRAIL PILOT OUTCOME REPORT
1. Executive Summary:
   - Pilot Period: [Start Date] to [End Date]
   - Total Companies: 5 | Qualified Active Companies (4 weeks): [X]/5
   - Total Tracked Shifts: [N] | Total GPS Points Processed: [N]

2. What Worked:
   - [e.g., Accuracy of stationary visit detection and automated voice transcription]
   - [e.g., Battery life impact was under 4% per 8-hour shift on Samsung and OnePlus]

3. What Didn't / Areas for Improvement:
   - [e.g., Aggressive background task killing on budget Vivo devices running Android 11]
   - [e.g., Clarifications needed on lunch break pausing vs. ending work session]

4. Broad Launch Recommendation:
   - [ ] PROCEED to Play Store public launch and commercial rollout.
   - [ ] ITERATE on identified gaps before general availability.
```
