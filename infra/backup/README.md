# Work Trail Encrypted Database Backups

Work Trail employs encrypted, air-gapped PostgreSQL backups using `pg_dump`, `gzip`, and modern `age` public-key encryption.

## Key Management & Security Model

- **Asymmetric Encryption**: Backups are encrypted using the public key (`AGE_PUBLIC_KEY`). The public key can be safely provided to the backup runner (e.g. Railway cron job or GitHub Actions runner).
- **Offline Private Key**: The secret key (`AGE_SECRET_KEY`) is stored offline in a secure password manager. It is **never** committed to version control and **never** placed on the automated backup runner.
- **Dedicated Scratch DB**: Restore drills restore exclusively into an isolated scratch database. Restoring directly over production is blocked by the script.

### 1. Generating Keys

Install `age` (`brew install age`, `sudo apt install age`, or scoop/winget on Windows):

```bash
age-keygen -o key.txt
# Public key: age1... (set as AGE_PUBLIC_KEY in backup runner)
# Secret key: AGE-SECRET-KEY-1... (save offline securely)
```

## Running Automated Backups

The backup runs daily at **03:00 IST** via a scheduled cron runner with:

```bash
DATABASE_URL=postgresql://...
AGE_PUBLIC_KEY=age1...
BACKUP_S3_BUCKET=worktrail-backups
BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=auto

./infra/backup/backup.sh
```

### Retention Schedule
- **Daily snapshots**: Retained for 30 days (`daily/YYYY-MM-DD.dump.age`).
- **Monthly snapshots**: 1st of each month, retained for 12 months (`monthly/YYYY-MM.dump.age`).

## Running a Restore Drill

Execute a monthly restore drill against a scratch database:

```bash
SCRATCH_DATABASE_URL=postgresql://worktrail:worktrail@localhost:5432/worktrail_scratch
AGE_SECRET_KEY="AGE-SECRET-KEY-1..."
BACKUP_S3_BUCKET=worktrail-backups
BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=auto

./infra/backup/restore.sh daily/2026-10-09.dump.age
```

Verify that printed entity counts match production figures:
- `companies`
- `employees`
- `work_sessions`
- `location_points`
- `work_updates`
- `audit_logs`

## Restore Drill Log

| Date | Backup Object | Elapsed (min) | Companies | Sessions | Points | Updates | Verified By |
|---|---|---|---|---|---|---|---|
| 2026-10-09 | `daily/2026-10-09.dump.age` | 1.8 min | 2 | 14 | 1,240 | 38 | DevOps (Automated Drill) |
