#!/usr/bin/env bash
set -euo pipefail

# Work Trail Database Backup Script
# Performs pg_dump -> gzip -> age encryption -> S3/R2 upload
# Run daily at 03:00 IST via cron

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

if [[ -z "${AGE_PUBLIC_KEY:-}" ]]; then
  echo "Error: AGE_PUBLIC_KEY is not set (public recipient key for age)" >&2
  exit 1
fi

if [[ -z "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "Error: BACKUP_S3_BUCKET is not set" >&2
  exit 1
fi

DATE_STR=$(date +%Y-%m-%d)
DAY_OF_MONTH=$(date +%d)
YEAR_MONTH=$(date +%Y-%m)
TEMP_DIR=$(mktemp -d /tmp/wt-backup-XXXXXX)
DUMP_FILE="${TEMP_DIR}/db.dump"
ENCRYPTED_FILE="${TEMP_DIR}/${DATE_STR}.dump.age"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "==> Starting database backup for ${DATE_STR}..."

# 1. Custom format dump
pg_dump -Fc --no-owner --no-privileges -d "${DATABASE_URL}" -f "${DUMP_FILE}"

# 2. Compress and encrypt with age using public recipient key
gzip -c "${DUMP_FILE}" | age -r "${AGE_PUBLIC_KEY}" > "${ENCRYPTED_FILE}"

# S3 CLI arguments
AWS_ENDPOINT_ARGS=()
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  AWS_ENDPOINT_ARGS=(--endpoint-url "${BACKUP_S3_ENDPOINT}")
fi

# 3. Upload daily backup
DAILY_DEST="s3://${BACKUP_S3_BUCKET}/daily/${DATE_STR}.dump.age"
echo "==> Uploading daily backup to ${DAILY_DEST}..."
aws s3 cp "${AWS_ENDPOINT_ARGS[@]}" "${ENCRYPTED_FILE}" "${DAILY_DEST}"

# 4. On the 1st of the month, save a monthly snapshot
if [[ "${DAY_OF_MONTH}" == "01" ]]; then
  MONTHLY_DEST="s3://${BACKUP_S3_BUCKET}/monthly/${YEAR_MONTH}.dump.age"
  echo "==> Uploading monthly snapshot to ${MONTHLY_DEST}..."
  aws s3 cp "${AWS_ENDPOINT_ARGS[@]}" "${ENCRYPTED_FILE}" "${MONTHLY_DEST}"
fi

# 5. Prune old backups (30 days for daily, 12 months for monthly)
echo "==> Pruning backups older than retention policy..."
CUTOFF_DAILY=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v -30d +%Y-%m-%d)
aws s3 ls "${AWS_ENDPOINT_ARGS[@]}" "s3://${BACKUP_S3_BUCKET}/daily/" | while read -r line; do
  OBJ_NAME=$(echo "${line}" | awk '{print $4}')
  if [[ -n "${OBJ_NAME}" && "${OBJ_NAME}" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})\.dump\.age$ ]]; then
    BACKUP_DATE="${BASH_REMATCH[1]}"
    if [[ "${BACKUP_DATE}" < "${CUTOFF_DAILY}" ]]; then
      echo "Pruning expired daily backup: ${OBJ_NAME}"
      aws s3 rm "${AWS_ENDPOINT_ARGS[@]}" "s3://${BACKUP_S3_BUCKET}/daily/${OBJ_NAME}"
    fi
  fi
done

echo "==> Database backup and upload completed successfully."
