-- One ACTIVE work session per employee (data-model.pdf). Prisma cannot express a
-- partial unique index in schema.prisma, so it lives here as raw SQL.
CREATE UNIQUE INDEX "work_sessions_one_active_per_employee"
  ON "work_sessions" ("employee_id") WHERE "status" = 'ACTIVE';
