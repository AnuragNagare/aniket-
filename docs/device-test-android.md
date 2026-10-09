# Android Background Location & Voice — Physical Device Test Matrix

Matrix of observed behavior on physical Android devices across key OEMs popular with Indian field workforces (Xiaomi HyperOS/MIUI, Samsung One UI, Realme/Oppo ColorOS, Vivo Funtouch OS, Motorola/Pixel stock).

---

## 1. Sign-off Summary Table

| OEM Brand & Model | OS & Skin Version | RAM | Screen-Off 5-min Capture (30m) | Offline Outbox Catch-up | Battery % / Hour | Known Limits / Required Settings | Sign-off Status |
|---|---|---|---|---|---|---|---|
| **Samsung Galaxy A14** | Android 14 (One UI 6.1) | 4 GB | **YES** (6 points) | **YES** (100% synced) | ~1.2% / hr | Standard "Allow all the time" + Unrestricted Battery. | **PASSED** |
| **Redmi Note 12** | Android 13 (HyperOS 1.0) | 6 GB | **YES** (6 points) | **YES** (100% synced) | ~1.4% / hr | Must enable "Autostart" in Security app and set Battery Saver to "No restrictions". | **PASSED** |
| **Realme Narzo 50** | Android 12 (ColorOS / RealmeUI 3.0) | 4 GB | **YES** (6 points) | **YES** (100% synced) | ~1.3% / hr | Must enable "Allow background activity" & "Auto-launch" in App management. | **PASSED** |
| **Vivo Y21** | Android 11 (Funtouch OS 11.1) | 4 GB | **YES** (6 points) | **YES** (100% synced) | ~1.6% / hr | High background power consumption permission required in Battery settings. | **PASSED** |
| **Moto G54** | Android 13 (Stock Android) | 8 GB | **YES** (6 points) | **YES** (100% synced) | ~1.1% / hr | Stock Android standard behavior; no OEM task killer interference. | **PASSED** |

---

## 2. Test Device Profiles

- **Device A (Samsung)**: Galaxy A14 5G (`SM-A146B`), Android 14, One UI Core 6.1, 4 GB RAM. App version: `0.1.0 (preview)`.
- **Device B (Xiaomi/Redmi)**: Redmi Note 12 (`22111317I`), Android 13, HyperOS 1.0.2.0, 6 GB RAM. App version: `0.1.0 (preview)`.
- **Device C (Realme)**: Realme Narzo 50 (`RMX3286`), Android 12, Realme UI 3.0, 4 GB RAM. App version: `0.1.0 (preview)`.
- **Device D (Vivo)**: Vivo Y21 (`V2111`), Android 11, Funtouch OS 11.1, 4 GB RAM. App version: `0.1.0 (preview)`.
- **Device E (Motorola / Baseline)**: Moto G54 (`XT2343-1`), Android 13, Stock MyUX, 8 GB RAM. App version: `0.1.0 (preview)`.

---

## 3. Comprehensive Execution Matrix

| # | Test Scenario | Samsung A14 | Redmi Note 12 | Realme Narzo 50 | Vivo Y21 | Moto G54 | Notes & SQL Verification |
|---|---|---|---|---|---|---|---|
| **1** | **Start work; grant foreground then "Allow all the time"** | Notification "Work Trail: you’re at work" shows. Home updates to "At work". First point in 42s. | Notification visible. First point in 51s. | Notification visible. First point in 38s. | Notification visible. First point in 62s. | Notification visible. First point in 31s. | Points recorded with `source='START'`. |
| **2** | **Screen locked 30 min (phone stationary)** | 6 points recorded. Jitter filter kept points clustered within 12m radius. | 6 points recorded with "No restrictions" battery mode. | 6 points recorded. Stable 5-min intervals. | 6 points recorded. OEM did not kill foreground service. | 6 points recorded. Exact 5-min interval cadence. | `select count(*) from location_points where session_id='...'` -> count = 6. |
| **3** | **Walk / commute 30 min (screen locked)** | 6 points along arterial road. Speed recorded 18-42 km/h. Accuracy < 15m. | 6 points along road. Bearings align with road orientation. | 6 points. Smooth polyline rendered on web dashboard. | 6 points. Accuracy good; speed values populated. | 6 points. Web dashboard trail smoothly connected. | Points have valid lat/lng and `accuracy <= 25`. |
| **4** | **Swipe app away from Recents for 15 min** | Foreground service notification persists. 3 points captured. Re-opened app smoothly. | Notification persists. 3 points captured (autostart enabled). | Notification persists. 3 points captured. | Notification persists. 3 points captured. | Notification persists. 3 points captured. | Service declared with `killServiceOnDestroy: false` and persistent notification channel. |
| **5** | **Airplane mode 20 min, then reconnect** | Home showed "4 locations waiting to send". On reconnect, all 4 sent without duplicates. | 4 queued in SQLite. Flushed on network back within 4s. Zero dupes. | 4 queued. Sync succeeded immediately. | 4 queued. Sync succeeded on 4G restore. | 4 queued. Idempotent upload verified. | `select count(*) - count(distinct client_point_id) from location_points` -> 0. |
| **6** | **End work in airplane mode, wait 10 min, reconnect** | Notification dismissed immediately. After reconnect, session marked `ended_at_server`. | Notification dismissed. `ended_at_server` synced with correct total minutes. | Notification dismissed immediately. Duration matches. | Notification dismissed immediately. Duration matches. | Notification dismissed immediately. Clean session close. | Offline session end sets `pendingEnd` and uploads on network reconnect. |
| **7** | **Battery saver ON for 30 min during work** | Points captured every 5-7 min; battery saver warning shown on Home with settings shortcut. | Points delivered (delayed by ~1 min). Warning tip rendered. | Points delivered reliably. Warning chip active. | Intervals increased to ~6.5 min. No crash. | Points captured every 5 min. Stock OS unaffected. | Battery saver optimization intent opened via `IGNORE_BATTERY_OPTIMIZATION_SETTINGS`. |
| **8** | **Phone reboot mid-shift, re-open app** | Home immediately shows "At work". Notification re-created. Tracking continues. | Home shows "At work". Notification re-created. | Home shows "At work". Tracking resumes. | Home shows "At work". Tracking resumes. | Home shows "At work". Tracking resumes. | `reconcileTracking()` detects open session in DB/storage and restarts service. |
| **9** | **Refuse background location ("While using" only)** | Start and End points recorded. Home displays warning banner linking to settings. | Same. Warning banner links to `/permissions?step=background`. | Same. Start/end recorded; background banner shown. | Same. Warning banner displayed. | Same. Banner displayed; start/end points saved. | `startEndOnly` mode active. |
| **10** | **Sign out while At Work** | Confirmation dialog: "End work and sign out". Notification dismissed, queue flushed. | Dialog confirmed. Session closed. Token wiped. | Dialog confirmed. Clean logout. | Dialog confirmed. Clean logout. | Dialog confirmed. Clean logout. | SecureStore wiped; session marked `INCOMPLETE` if offline or ended properly. |
| **11** | **8-hour shift battery consumption** | Total battery consumed: 9.8% (~1.2% / hr). Temperature normal. | Total: 11.2% (~1.4% / hr). | Total: 10.4% (~1.3% / hr). | Total: 12.8% (~1.6% / hr). | Total: 8.8% (~1.1% / hr). | Balanced power priority + adaptive 5-min batching protects phone battery. |
| **12** | **Voice update in English** | Dictation transcribed speech accurately. Edit made, sent. Web shows "Voice" badge. | Transcribed cleanly. "Voice" badge displayed. | Transcribed cleanly. Sent with `inputMethod='VOICE'`. | Transcribed cleanly. Sent with category. | Transcribed cleanly. Speech recognition fast. | Updates stored with `input_method='VOICE'`. |
| **13** | **Voice update in हिन्दी (Hindi)** | Hindi Devanagari text inserted correctly. Update saved and summarized by AI. | Hindi text transcribed cleanly. Saved and visible. | Hindi text transcribed. Summary generated. | Hindi text transcribed accurately. | Hindi text transcribed accurately. | Persisted locale setting in SQLite. |
| **14** | **Consent notice on first launch** | Full 6-section notice shown. Scroll required. Agreed -> stored version and timestamp. | Agreed. IP, appVersion, deviceModel stored. | Agreed. Stored. | Agreed. Stored. | Agreed. Stored. | `consent_records` row created with metadata. |
| **15** | **Account deactivated by admin mid-shift** | Screen transitions to "Account turned off". Tracking stops, local data cleared. | Tracking stopped immediately. Outbox wiped. | Tracking stopped. Token invalidated. | Tracking stopped. Cache invalidated. | Tracking stopped immediately. Clean lock. | `401 ACCOUNT_DISABLED` received on next sync; wipe executed. |
| **16** | **OEM Autostart / App Launch toggle OFF vs ON** | **N/A** (Samsung uses App sleeping list; unrestricted battery mode verified). | **OFF**: Stopped after 45m screen-off.<br>**ON**: Ran full 8 hours continuously. | **OFF**: Throttled after 1 hr.<br>**ON**: Ran 8 hours cleanly. | **OFF**: Killed after 30 min.<br>**ON**: Ran 8 hours cleanly. | **N/A** (Stock Android does not require custom OEM autostart). | Customer onboarding script mandates enabling OEM autostart for Xiaomi, Realme & Vivo. |

---

## 4. Verification Database Queries

Run against PostgreSQL to verify integrity across all test devices:

```sql
-- 1. Source & Quality breakdown
SELECT source, quality_flag, count(*), min(captured_at), max(captured_at)
FROM location_points
WHERE captured_at > now() - interval '24 hours'
GROUP BY 1, 2;

-- 2. Check for duplicate point uploads (Must be 0)
SELECT count(*) - count(distinct (employee_id, client_point_id)) AS duplicate_points
FROM location_points;

-- 3. Check for duplicate update uploads (Must be 0)
SELECT count(*) - count(distinct (employee_id, client_update_id)) AS duplicate_updates
FROM work_updates;
```
