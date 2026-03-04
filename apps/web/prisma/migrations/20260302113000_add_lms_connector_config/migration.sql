-- Add site-level LMS connector configuration storage
ALTER TABLE "Site"
ADD COLUMN "lms_connector" JSONB;

