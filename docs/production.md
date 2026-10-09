# Work Trail Production Operations & Architecture

## 1. Production Architecture Layout

| Component | Platform / Host | Region | Notes |
|---|---|---|---|
| **Web Dashboard** | Vercel | Mumbai (`bom1`) | Next.js 15 App Router |
| **API Service** | Railway | Singapore / Asia | Node.js 22 Slim, Docker image (`apps/api/Dockerfile`) |
| **Queue Worker** | Railway | Singapore / Asia | Same image as API, command `node dist/worker.js` |
| **PostgreSQL 16 + PostGIS** | Railway | Singapore / Asia | PostGIS extensions active |
| **Redis 7** | Railway | Singapore / Asia | Job queue broker for BullMQ |
| **Object Storage (Reports/Exports)** | Cloudflare R2 | Auto | Private bucket, path style, S3-compatible |
| **Encrypted Backups** | Cloudflare R2 | Auto | Separate bucket with distinct access keys |
| **Error Tracking** | Sentry | Global | Configured with data scrubbing |
| **Uptime Monitoring** | Better Stack / UptimeRobot | Global | Monitored: `/api/v1/health/ready` & `/login` |
| **Transactional Email** | Resend | Global | Password resets and company invites |

---

## 2. Environment Variables & Secret Configuration

| Variable | Scope | Secret? | Description |
|---|---|---|---|
| `NODE_ENV` | API, Worker | No | Set to `production` |
| `PORT` | API | No | Defaults to `4000` (or Railway port `$PORT`) |
| `DATABASE_URL` | API, Worker | **YES** | Postgres connection string with PostGIS |
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
| `ANTHROPIC_API_KEY` | API, Worker | **YES** | Claude API key |
| `AI_UPDATE_MODEL` | API, Worker | No | `claude-opus-5-5` |
| `AI_REPORT_MODEL` | API, Worker | No | `claude-opus-5-5` |
| `SENTRY_DSN` | API, Worker, Web | No | Sentry monitoring DSN |
| `SENTRY_ENVIRONMENT` | API, Worker, Web | No | `production` |
| `TRUST_PROXY` | API | No | `true` |
| `RETENTION_RUN_HOUR_IST` | Worker | No | `2` (Runs at 02:00 IST) |
| `EXPORT_TTL_DAYS` | API, Worker | No | `7` |

---

## 3. Deployment & Release Steps

1. **Build Container Image**:
   Railway builds `apps/api/Dockerfile` from git push.
2. **Execute Database Migrations**:
   Run database migrations as a release phase:
   ```bash
   npx prisma migrate deploy
   ```
3. **Deploy API Service**:
   Start process: `node dist/main.js`.
4. **Deploy Worker Service**:
   Start process: `node dist/worker.js`.
5. **Verify Health**:
   Query readiness probe:
   ```bash
   curl -f https://api.worktrail.in/api/v1/health/ready
   # Expected response: {"db":"up","redis":"up"}
   ```

---

## 4. Operational Runbook

### Scaling the Worker
When background jobs increase (e.g. bulk 30-day PDF report generation):
1. In Railway, scale Worker replicas from `1` to `2` or `3`.
2. BullMQ automatically distributes tasks across all worker instances.
3. Monitor Redis memory and Anthropic rate limits.

### Rotating `JWT_ACCESS_SECRET`
To rotate `JWT_ACCESS_SECRET` without sudden session invalidation:
1. Update `JWT_ACCESS_SECRET` in Railway dashboard and redeploy.
2. Active access tokens (15-min TTL) expire naturally.
3. Refresh tokens stored in PostgreSQL will reissue valid new access tokens upon next refresh.

### Rolling Back Deployments
1. In Railway service deployment history, select the previous stable build and click **Rollback**.
2. If schema changes need rollback, inspect migrations and apply reverse SQL migration before reverting code.

### Troubleshooting: Dashboard Slow or Summaries Delayed
1. **Check Readiness**: Test `GET /api/v1/health/ready` to verify Postgres and Redis responsiveness.
2. **Check Redis Queue Backlog**:
   Check if jobs are stuck in `QUEUED` state for > 5 minutes:
   ```sql
   SELECT id, status, created_at FROM generated_summaries WHERE status = 'QUEUED' ORDER BY created_at ASC LIMIT 10;
   ```
3. **Check Worker Logs**:
   Look for Anthropic API timeouts, rate-limit 429 errors, or Chromium crashes in the PDF generation jobs.
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
