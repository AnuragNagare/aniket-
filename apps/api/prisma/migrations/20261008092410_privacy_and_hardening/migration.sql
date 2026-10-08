-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "ip" VARCHAR(64),
ADD COLUMN     "user_agent" VARCHAR(255);

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_version" VARCHAR(32),
    "device_model" VARCHAR(80),
    "ip" VARCHAR(64),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "storage_key" TEXT,
    "byte_size" INTEGER,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_employee_id_version_key" ON "consent_records"("employee_id", "version");

-- CreateIndex
CREATE INDEX "deletion_requests_company_id_status_idx" ON "deletion_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "data_exports_company_id_created_at_idx" ON "data_exports"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_action_created_at_idx" ON "audit_logs"("company_id", "action", "created_at");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
