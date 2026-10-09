# Work Trail Production Operations & Architecture

## 1. Production Architecture Layout

| Component | Platform / Host | Region | Notes |
|---|---|---|---|
| **Web Dashboard** | Vercel | Mumbai (`bom1`) | Next.js App Router. Project root directory `apps/web`, config in `apps/web/vercel.json` |
| **API Service** | Render (web service) | Singapore | Docker image (`apps/api/Dockerfile`), defined in `render.yaml` |
| **Queue Worker** | Render (background worker) | Singapore | Same image, command `node dist/worker.js`. Runs headless Chromium for PDFs, so use Starter or larger |
| **PostgreSQL 16** | Render Postgres | Singapore | No PostGIS needed: no migration uses it |
| **Redis** | Render Key Value | Singapore | BullMQ broker, `noeviction` policy, internal connections only |
| **Object Storage (Reports/Exports)** | Cloudflare R2 (S3-compatible) | Auto | Private bucket. Render disks cannot be shared between the API and the worker, so local disk is not an option |
| **Encrypted Backups** | Cloudflare R2 | Auto | Separate bucket with distinct access keys |
| **Error Tracking** | Sentry | Global | Required in production. Configured with data scrubbing |
| **Uptime Monitoring** | Better Stack / UptimeRobot | Global | Monitored: `/api/v1/health/ready` and `/login` |
| **Transactional Email** | Resend | Global | Password resets and company invites. Needs a verified sending domain |
| **AI** | Groq | Global | `openai/gpt-oss-20b` (updates), `openai/gpt-oss-120b` (reports) |

---

## 2. Environment Variables & Secret Configuration

| Variable | Scope | Secret? | Description |
|---|---|---|---|
| `NODE_ENV` | API, Worker | No | Set to `production` |
| `PORT` | API | No | Defaults to `4000` (Render sets `$PORT`) |
| `DATABASE_URL` | API, Worker | **YES** | Postgres connection string (filled from the Render database by `render.yaml`) |
| `JWT_ACCESS_SECRET` | API, Worker | **YES** | 64+ random characters for signing JWTs |
| `ACCESS_TOKEN_TTL_SECONDS`| API | No | Default `900` (15 minutes) |
| `REFRESH_TOKEN_TTL_DAYS` | API | No | Default `30` (30 days) |
| `WEB_ORIGIN` | API | No | e.g. `https://app.worktrail.in` |
| `QUEUE_DRIVER` | API, Worker | No | Must be `bullmq` in production |
| `REDIS_URL` | API, Worker | **YES** | Redis URL for BullMQ |
| `STORAGE_DRIVER` | API, Worker | No | Must be `s3` in production |
| `S3_ENDPOINT` | API, Worker | No | Cloudflare R2 endpoint URL |
| `S3_BUCKET` | API, Worker | No | e.g. `worktrail-reports-prod` |
| `S3_ACCESS_KEY_ID` | API, Worker | **YES** | R2 API token access key ID |
| `S3_SECRET_ACCESS_KEY` | API, Worker | **YES** | R2 API token secret access key |
| `S3_REGION` | API, Worker | No | `auto` |
| `ALLOW_LOCAL_STORAGE` | API, Worker | No | `false` in production |
| `AI_ENABLED` | API, Worker | No | `true` |
| `GROQ_API_KEY` | API, Worker | **YES** | Groq API key (`gsk_...`) |
| `RESEND_API_KEY` | API, Worker | **YES** | Resend key for invite and password-reset email. Without it, mail is only logged and not delivered. |
| `MAIL_FROM` | API, Worker | No | Sender, e.g. `Work Trail <no-reply@worktrail.in>` (domain must be verified in Resend) |
| `AI_UPDATE_MODEL` | API, Worker | No | `openai/gpt-oss-20b` |
| `AI_REPORT_MODEL` | API, Worker | No | `openai/gpt-oss-120b` |
| `SENTRY_DSN` | API, Worker, Web | No | Sentry monitoring DSN |
| `SENTRY_ENVIRONMENT` | API, Worker, Web | No | `production` |
| `TRUST_PROXY` | API | No | `true` |
| `RETENTION_RUN_HOUR_IST` | Worker | No | `2` (Runs at 02:00 IST) |
| `EXPORT_TTL_DAYS` | API, Worker | No | `7` |
| `API_URL` | Web (Vercel) | No | Public URL of the Render API, e.g. `https://worktrail-api.onrender.com` (no `/api/v1`) |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | Web (Vercel) | No | Must match the API values so cookie lifetimes line up |
| `NEXT_PUBLIC_SENTRY_DSN` | Web (Vercel) | No | Browser Sentry DSN |

---

## 3. Deployment & Release Steps

**API, worker, database and Redis (Render):**
1. Push the repo to GitHub, then in Render choose **New > Blueprint** and select the repo. Render reads `render.yaml`.
2. Fill the `sync: false` values when prompted: `GROQ_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `SENTRY_DSN`, `S3_*`, `WEB_ORIGIN`. `JWT_ACCESS_SECRET` is generated for you and shared by the API and worker.
3. Migrations run automatically before each API deploy (`preDeployCommand`: `prisma migrate deploy`, version pinned to 6.19.3).
4. Verify health:
   ```bash
   curl -f https://<api-host>/api/v1/health/ready
   # Expected response: {"db":"up","redis":"up"}
   ```

**Web (Vercel):**
1. Import the same repo as a new project. Set **Root Directory** to `apps/web` and enable **Include source files outside of the Root Directory**.
2. The install and build commands come from `apps/web/vercel.json`.
3. Set `API_URL` to the Render API URL, plus the Sentry and token TTL variables from the table above.
4. Set the API's `WEB_ORIGIN` to the final Vercel domain (CORS and invite links use it), then redeploy the API.

**Mobile:** the EAS `preview` and `production` profiles point at `https://api.worktrail.in`. Either map that domain to the Render API or change `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` before building.

---

## 4. Operational Runbook

### Scaling the Worker
When background jobs increase (e.g. bulk 30-day PDF report generation):
1. In Render, scale the worker instances from `1` to `2` or `3`.
2. BullMQ automatically distributes tasks across all worker instances.
3. Monitor Redis memory and Groq rate limits.

### Rotating `JWT_ACCESS_SECRET`
To rotate `JWT_ACCESS_SECRET` without sudden session invalidation:
1. Update `JWT_ACCESS_SECRET` in the Render shared environment group and redeploy the API and worker.
2. Active access tokens (15-min TTL) expire naturally.
3. Refresh tokens stored in PostgreSQL will reissue valid new access tokens upon next refresh.

### Rolling Back Deployments
1. In the Render service's Deploys list, choose the previous stable deploy and click **Rollback** (and promote the previous deployment on Vercel for the web app).
2. If schema changes need rollback, inspect migrations and apply reverse SQL migration before reverting code.

### Troubleshooting: Dashboard Slow or Summaries Delayed
1. **Check Readiness**: Test `GET /api/v1/health/ready` to verify Postgres and Redis responsiveness.
2. **Check Redis Queue Backlog**:
   Check if jobs are stuck in `QUEUED` state for > 5 minutes:
   ```sql
   SELECT id, status, created_at FROM generated_summaries WHERE status = 'QUEUED' ORDER BY created_at ASC LIMIT 10;
   ```
3. **Check Worker Logs**:
   Look for Groq API timeouts, rate-limit 429 errors, or Chromium crashes in the PDF generation jobs.
4. **Inspect Sentry**:
   Verify unresolved errors tagged with `worker` or `api`.

---

## 5. Production Smoke Test Checklist

After setting up the production environment:
1. [ ] Sign up a test company account (`admin@test.worktrail.in`).
2. [ ] Invite a test employee.
3. [ ] Log in with preview APK on an Android device.
4. [ ] Accept privacy notice and grant background location permissions.
5. [ ] Tap **Start work**, verify location point is recorded within 2 minutes.
6. [ ] Record an update (typed and voice).
7. [ ] Tap **End work**, verify session duration is calculated.
8. [ ] Generate and download PDF period report from the web dashboard.
9. [ ] Request data export ZIP and download from `/api/exports/{id}/download`.
10. [ ] Execute employee erasure and verify data deletion.
11. [ ] Run `ops:erase-company` to verify clean pilot exit cleanup.

---

## 6. Support Procedures

### Company Erasure (Pilot Exit / Customer Data Erasure)

When a customer formally requests complete account and data erasure in writing:
1. Obtain written sign-off from the authorized company representative.
2. Identify the company UUID and exact registered company name.
3. Run the company erasure script with exact name confirmation:
   ```bash
   pnpm --filter @worktrail/api ops:erase-company -- --company <company-id> --confirm "<exact company name>"
   ```
4. Verify that the displayed employee, user, and session counts match the customer.
5. Type `ERASE` when prompted to confirm (or pass `--yes` in non-interactive automated workflows).
6. The procedure:
   - Erases all employee data (sessions, location points, updates, summaries, reports, data exports, consent records).
   - Removes all report and export files from object storage.
   - Deletes all user accounts, invitations, refresh tokens, and password reset tokens.
   - Updates company name to "Deleted company" and sets retention to 30 days.
   - Preserves audit log history and records a final `company.erased` audit entry with counts.
