-- Add idempotency key for public sign-in dedupe.
ALTER TABLE "SignInRecord"
ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "SignInRecord_company_id_idempotency_key_key"
ON "SignInRecord"("company_id", "idempotency_key");

-- Support export queue query patterns.
CREATE INDEX "ExportJob_company_id_queued_at_idx"
ON "ExportJob"("company_id", "queued_at");

CREATE INDEX "ExportJob_company_id_status_run_at_idx"
ON "ExportJob"("company_id", "status", "run_at");

-- Support global retention sweeps by time.
CREATE INDEX "AuditLog_created_at_idx"
ON "AuditLog"("created_at");
