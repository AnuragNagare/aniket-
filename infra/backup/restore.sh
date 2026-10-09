#!/usr/bin/env bash
set -euo pipefail

# Work Trail Restore Drill Script
# Downloads an encrypted backup, decrypts with age private key,
# and restores into an ISOLATED SCRATCH database to verify integrity.
# NEVER RESTORES OVER PRODUCTION.

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <s3-object-key>" >&2
  echo "Example: $0 daily/2026-10-09.dump.age" >&2
  exit 1
fi

OBJECT_KEY="$1"

if [[ -z "${SCRATCH_DATABASE_URL:-}" ]]; then
  echo "Error: SCRATCH_DATABASE_URL is not set" >&2
  echo "Safety Rule: Restore drills must only execute against a dedicated scratch database." >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && "${SCRATCH_DATABASE_URL}" == "${DATABASE_URL}" ]]; then
  echo "CRITICAL SAFETY ERROR: SCRATCH_DATABASE_URL is identical to DATABASE_URL!" >&2
  echo "Restoring directly over production is prohibited." >&2
  exit 1
fi

if [[ -z "${AGE_SECRET_KEY_FILE:-}" && -z "${AGE_SECRET_KEY:-}" ]]; then
  echo "Error: Neither AGE_SECRET_KEY_FILE nor AGE_SECRET_KEY is set." >&2
  exit 1
fi

if [[ -z "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "Error: BACKUP_S3_BUCKET is not set" >&2
  exit 1
fi

TEMP_DIR=$(mktemp -d /tmp/wt-restore-XXXXXX)
ENCRYPTED_FILE="${TEMP_DIR}/backup.dump.age"
DECRYPTED_FILE="${TEMP_DIR}/backup.dump"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

AWS_ENDPOINT_ARGS=()
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  AWS_ENDPOINT_ARGS=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
fi

S3_SOURCE="s3://${BACKUP_S3_BUCKET}/${OBJECT_KEY}"
echo "==> Downloading backup from ${S3_SOURCE}..."
aws s3 cp "${AWS_ENDPOINT_ARGS[@]}" "${S3_SOURCE}" "${ENCRYPTED_FILE}"

echo "==> Decrypting and uncompressing backup..."
if [[ -n "${AGE_SECRET_KEY_FILE:-}" ]]; then
  age -d -i "${AGE_SECRET_KEY_FILE}" "${ENCRYPTED_FILE}" | gunzip > "${DECRYPTED_FILE}"
else
  echo "${AGE_SECRET_KEY}" | age -d -i - "${ENCRYPTED_FILE}" | gunzip > "${DECRYPTED_FILE}"
fi

echo "==> Restoring dump into scratch database..."
pg_restore --clean --if-exists --no-owner --no-privileges -d "${SCRATCH_DATABASE_URL}" "${DECRYPTED_FILE}" || true

echo ""
echo "=========================================================="
echo " RESTORE VERIFICATION SUMMARY (SCRATCH DATABASE)"
echo "=========================================================="

psql "${SCRATCH_DATABASE_URL}" -t -A -c "
SELECT 'companies:       ' || count(*) FROM companies
UNION ALL
SELECT 'employees:       ' || count(*) FROM employees
UNION ALL
SELECT 'work_sessions:   ' || count(*) FROM work_sessions
UNION ALL
SELECT 'location_points: ' || count(*) FROM location_points
UNION ALL
SELECT 'work_updates:    ' || count(*) FROM work_updates
UNION ALL
SELECT 'audit_logs:      ' || count(*) FROM audit_logs;
"

echo "=========================================================="
echo " Restore drill complete. Verify that counts match production baseline."
