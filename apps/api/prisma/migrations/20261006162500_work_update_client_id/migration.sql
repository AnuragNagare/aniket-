-- AlterTable
ALTER TABLE "work_updates" ADD COLUMN "client_update_id" UUID;
UPDATE "work_updates" SET "client_update_id" = gen_random_uuid() WHERE "client_update_id" IS NULL;
ALTER TABLE "work_updates" ALTER COLUMN "client_update_id" SET NOT NULL;
ALTER TABLE "work_updates" ADD COLUMN "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "work_updates_employee_id_client_update_id_key" ON "work_updates"("employee_id", "client_update_id");
