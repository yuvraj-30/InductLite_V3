-- Add construction safety form suite and expand named access connector providers.

ALTER TYPE "AccessConnectorProvider" ADD VALUE IF NOT EXISTS 'GALLAGHER';
ALTER TYPE "AccessConnectorProvider" ADD VALUE IF NOT EXISTS 'LENELS2';
ALTER TYPE "AccessConnectorProvider" ADD VALUE IF NOT EXISTS 'GENETEC';

CREATE TYPE "SafetyFormType" AS ENUM (
  'SWMS',
  'JSA',
  'RAMS',
  'TOOLBOX_TALK',
  'FATIGUE_DECLARATION'
);

CREATE TYPE "SafetyFormSubmissionStatus" AS ENUM (
  'SUBMITTED',
  'REVIEWED',
  'REJECTED'
);

CREATE TABLE "SafetyFormTemplate" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT,
  "name" TEXT NOT NULL,
  "form_type" "SafetyFormType" NOT NULL,
  "description" TEXT,
  "field_schema" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SafetyFormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyFormSubmission" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "sign_in_record_id" TEXT,
  "submitted_by_name" TEXT NOT NULL,
  "submitted_by_email" TEXT,
  "submitted_by_phone" TEXT,
  "payload" JSONB NOT NULL,
  "summary" TEXT,
  "status" "SafetyFormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "review_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SafetyFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SafetyFormTemplate_company_id_site_id_name_form_type_key"
ON "SafetyFormTemplate"("company_id", "site_id", "name", "form_type");

CREATE INDEX "SafetyFormTemplate_company_id_idx"
ON "SafetyFormTemplate"("company_id");

CREATE INDEX "SafetyFormTemplate_company_id_site_id_is_active_idx"
ON "SafetyFormTemplate"("company_id", "site_id", "is_active");

CREATE INDEX "SafetyFormTemplate_company_id_form_type_is_active_idx"
ON "SafetyFormTemplate"("company_id", "form_type", "is_active");

CREATE INDEX "SafetyFormSubmission_company_id_idx"
ON "SafetyFormSubmission"("company_id");

CREATE INDEX "SafetyFormSubmission_company_id_site_id_submitted_at_idx"
ON "SafetyFormSubmission"("company_id", "site_id", "submitted_at");

CREATE INDEX "SafetyFormSubmission_company_id_template_id_status_idx"
ON "SafetyFormSubmission"("company_id", "template_id", "status");

CREATE INDEX "SafetyFormSubmission_sign_in_record_id_idx"
ON "SafetyFormSubmission"("sign_in_record_id");

ALTER TABLE "SafetyFormSubmission"
ADD CONSTRAINT "SafetyFormSubmission_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "SafetyFormTemplate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
