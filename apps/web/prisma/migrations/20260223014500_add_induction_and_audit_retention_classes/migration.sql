-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "induction_retention_days" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN "audit_retention_days" INTEGER NOT NULL DEFAULT 90;
