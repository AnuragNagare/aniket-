-- AlterEnum
ALTER TYPE "PeriodType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "generated_summaries" ADD COLUMN     "failure_reason" VARCHAR(120),
ADD COLUMN     "model_name" VARCHAR(120),
ADD COLUMN     "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "byte_size" INTEGER,
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "failure_reason" VARCHAR(120),
ADD COLUMN     "include_map" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "summary_id" UUID;

-- AlterTable
ALTER TABLE "work_updates" ADD COLUMN     "summary_error" VARCHAR(120),
ADD COLUMN     "summary_generated_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "generated_summaries_company_id_employee_id_idx" ON "generated_summaries"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "reports_company_id_created_at_idx" ON "reports"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "generated_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
