-- CreateEnum
CREATE TYPE "HazardRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY');

-- AlterTable
ALTER TABLE "InductionResponse" ADD COLUMN     "signature_captured_at" TIMESTAMP(3),
ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signature_mime_type" TEXT,
ADD COLUMN     "signature_size_bytes" INTEGER;

-- AlterTable
ALTER TABLE "SignInRecord" ADD COLUMN     "consent_statement" TEXT,
ADD COLUMN     "privacy_version_id" TEXT,
ADD COLUMN     "terms_version_id" TEXT;

-- CreateTable
CREATE TABLE "HazardRegisterEntry" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "risk_level" "HazardRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "HazardStatus" NOT NULL DEFAULT 'OPEN',
    "controls" JSONB,
    "identified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identified_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardRegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteEmergencyContact" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteEmergencyProcedure" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteEmergencyProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_type" "LegalDocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "content_hash" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_company_id_idx" ON "HazardRegisterEntry"("company_id");

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_company_id_site_id_idx" ON "HazardRegisterEntry"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_company_id_status_idx" ON "HazardRegisterEntry"("company_id", "status");

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_company_id_risk_level_idx" ON "HazardRegisterEntry"("company_id", "risk_level");

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_identified_by_idx" ON "HazardRegisterEntry"("identified_by");

-- CreateIndex
CREATE INDEX "HazardRegisterEntry_closed_by_idx" ON "HazardRegisterEntry"("closed_by");

-- CreateIndex
CREATE INDEX "SiteEmergencyContact_company_id_idx" ON "SiteEmergencyContact"("company_id");

-- CreateIndex
CREATE INDEX "SiteEmergencyContact_company_id_site_id_idx" ON "SiteEmergencyContact"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "SiteEmergencyContact_company_id_site_id_is_active_idx" ON "SiteEmergencyContact"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "SiteEmergencyContact_site_id_priority_idx" ON "SiteEmergencyContact"("site_id", "priority");

-- CreateIndex
CREATE INDEX "SiteEmergencyProcedure_company_id_idx" ON "SiteEmergencyProcedure"("company_id");

-- CreateIndex
CREATE INDEX "SiteEmergencyProcedure_company_id_site_id_idx" ON "SiteEmergencyProcedure"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "SiteEmergencyProcedure_company_id_site_id_is_active_idx" ON "SiteEmergencyProcedure"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "SiteEmergencyProcedure_site_id_sort_order_idx" ON "SiteEmergencyProcedure"("site_id", "sort_order");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_company_id_idx" ON "LegalDocumentVersion"("company_id");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_company_id_document_type_effective_at_idx" ON "LegalDocumentVersion"("company_id", "document_type", "effective_at");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_created_by_idx" ON "LegalDocumentVersion"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_company_id_document_type_version_key" ON "LegalDocumentVersion"("company_id", "document_type", "version");

-- CreateIndex
CREATE INDEX "EmailNotification_user_id_idx" ON "EmailNotification"("user_id");

-- CreateIndex
CREATE INDEX "InductionResponse_signature_hash_idx" ON "InductionResponse"("signature_hash");

-- CreateIndex
CREATE INDEX "SignInRecord_signed_out_by_idx" ON "SignInRecord"("signed_out_by");

-- CreateIndex
CREATE INDEX "SignInRecord_terms_version_id_idx" ON "SignInRecord"("terms_version_id");

-- CreateIndex
CREATE INDEX "SignInRecord_privacy_version_id_idx" ON "SignInRecord"("privacy_version_id");

-- AddForeignKey
ALTER TABLE "SignInRecord" ADD CONSTRAINT "SignInRecord_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInRecord" ADD CONSTRAINT "SignInRecord_privacy_version_id_fkey" FOREIGN KEY ("privacy_version_id") REFERENCES "LegalDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardRegisterEntry" ADD CONSTRAINT "HazardRegisterEntry_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardRegisterEntry" ADD CONSTRAINT "HazardRegisterEntry_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardRegisterEntry" ADD CONSTRAINT "HazardRegisterEntry_identified_by_fkey" FOREIGN KEY ("identified_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardRegisterEntry" ADD CONSTRAINT "HazardRegisterEntry_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEmergencyContact" ADD CONSTRAINT "SiteEmergencyContact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEmergencyContact" ADD CONSTRAINT "SiteEmergencyContact_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEmergencyProcedure" ADD CONSTRAINT "SiteEmergencyProcedure_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEmergencyProcedure" ADD CONSTRAINT "SiteEmergencyProcedure_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

