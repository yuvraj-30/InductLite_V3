-- Add company-level data residency metadata for tenant-facing controls.
ALTER TABLE "Company"
ADD COLUMN "data_residency_region" TEXT,
ADD COLUMN "data_residency_scope" TEXT,
ADD COLUMN "data_residency_notes" TEXT,
ADD COLUMN "data_residency_attested_at" TIMESTAMP(3),
ADD COLUMN "data_residency_attested_by" TEXT;

-- Add optional visitor identity evidence pointers on sign-in records.
ALTER TABLE "SignInRecord"
ADD COLUMN "visitor_photo_evidence" TEXT,
ADD COLUMN "visitor_id_evidence" TEXT,
ADD COLUMN "visitor_id_evidence_type" TEXT;
