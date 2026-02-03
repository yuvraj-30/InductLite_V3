-- Safe non-destructive migration
-- Rename existing enums and tables to preserve data before applying further destructive schema changes.
-- This migration intentionally DOES NOT DROP DATA. Instead it renames objects to <name>_old.

BEGIN;

-- Rename enums (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
    EXECUTE 'ALTER TYPE "UserRole" RENAME TO "UserRole_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questiontype') THEN
    EXECUTE 'ALTER TYPE "QuestionType" RENAME TO "QuestionType_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visitortype') THEN
    EXECUTE 'ALTER TYPE "VisitorType" RENAME TO "VisitorType_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documenttype') THEN
    EXECUTE 'ALTER TYPE "DocumentType" RENAME TO "DocumentType_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exporttype') THEN
    EXECUTE 'ALTER TYPE "ExportType" RENAME TO "ExportType_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exportstatus') THEN
    EXECUTE 'ALTER TYPE "ExportStatus" RENAME TO "ExportStatus_old"';
  END IF;
END$$;

-- Helper: rename table if it exists
-- Use lowercase checks against information_schema, but preserve casing by quoting names below
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company') THEN
    EXECUTE 'ALTER TABLE "Company" RENAME TO "Company_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user') THEN
    EXECUTE 'ALTER TABLE "User" RENAME TO "User_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='site') THEN
    EXECUTE 'ALTER TABLE "Site" RENAME TO "Site_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sitepubliclink') THEN
    EXECUTE 'ALTER TABLE "SitePublicLink" RENAME TO "SitePublicLink_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inductiontemplate') THEN
    EXECUTE 'ALTER TABLE "InductionTemplate" RENAME TO "InductionTemplate_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inductionquestion') THEN
    EXECUTE 'ALTER TABLE "InductionQuestion" RENAME TO "InductionQuestion_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signinrecord') THEN
    EXECUTE 'ALTER TABLE "SignInRecord" RENAME TO "SignInRecord_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inductionresponse') THEN
    EXECUTE 'ALTER TABLE "InductionResponse" RENAME TO "InductionResponse_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contractor') THEN
    EXECUTE 'ALTER TABLE "Contractor" RENAME TO "Contractor_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contractordocument') THEN
    EXECUTE 'ALTER TABLE "ContractorDocument" RENAME TO "ContractorDocument_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='exportjob') THEN
    EXECUTE 'ALTER TABLE "ExportJob" RENAME TO "ExportJob_old"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='auditlog') THEN
    EXECUTE 'ALTER TABLE "AuditLog" RENAME TO "AuditLog_old"';
  END IF;
END$$;

COMMIT;

-- Notes:
-- 1) This migration is intentionally conservative: it renames existing objects to *_old so that data is preserved.
-- 2) After this runs, a future migration can create the new intended schema (matching prisma/schema.prisma).
-- 3) Reviewers should validate and decide whether to migrate data from *_old tables into the new schema or to drop them later after retention window.
