-- Add company-level SSO configuration and user identity linkage fields.
ALTER TABLE "Company"
ADD COLUMN "sso_config" JSONB;

ALTER TABLE "User"
ADD COLUMN "identity_provider" TEXT,
ADD COLUMN "identity_subject" TEXT,
ADD COLUMN "directory_synced_at" TIMESTAMP(3);

CREATE INDEX "User_company_id_identity_subject_idx"
ON "User"("company_id", "identity_subject");

CREATE UNIQUE INDEX "User_company_id_identity_provider_identity_subject_key"
ON "User"("company_id", "identity_provider", "identity_subject");
