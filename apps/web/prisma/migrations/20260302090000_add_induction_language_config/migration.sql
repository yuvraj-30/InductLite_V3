-- Add template-level multi-language configuration payload.
ALTER TABLE "InductionTemplate"
ADD COLUMN "induction_languages" JSONB;
