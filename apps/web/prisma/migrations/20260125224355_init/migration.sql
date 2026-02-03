-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'MULTIPLE_CHOICE', 'CHECKBOX', 'YES_NO', 'ACKNOWLEDGMENT');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('CONTRACTOR', 'VISITOR', 'EMPLOYEE', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INSURANCE', 'CERTIFICATION', 'LICENSE', 'TRAINING', 'HEALTH_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('SIGN_IN_CSV', 'INDUCTION_CSV', 'SITE_PACK_PDF', 'COMPLIANCE_ZIP');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL DEFAULT 365,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "induction_template_id" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePublicLink" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "SitePublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InductionTemplate" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InductionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InductionQuestion" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    "correct_answer" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InductionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignInRecord" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" TEXT,
    "employer_name" TEXT,
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'CONTRACTOR',
    "sign_in_ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sign_out_ts" TIMESTAMP(3),
    "sign_out_token" TEXT,
    "sign_out_token_exp" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InductionResponse" (
    "id" TEXT NOT NULL,
    "sign_in_record_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InductionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "trade" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorDocument" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ContractorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "export_type" "ExportType" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "parameters" JSONB NOT NULL,
    "file_path" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "error_message" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "requested_by" TEXT NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_company_id_idx" ON "User"("company_id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_company_id_email_key" ON "User"("company_id", "email");

-- CreateIndex
CREATE INDEX "Site_company_id_idx" ON "Site"("company_id");

-- CreateIndex
CREATE INDEX "Site_company_id_is_active_idx" ON "Site"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Site_company_id_name_key" ON "Site"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SitePublicLink_slug_key" ON "SitePublicLink"("slug");

-- CreateIndex
CREATE INDEX "SitePublicLink_slug_idx" ON "SitePublicLink"("slug");

-- CreateIndex
CREATE INDEX "SitePublicLink_site_id_idx" ON "SitePublicLink"("site_id");

-- CreateIndex
CREATE INDEX "InductionTemplate_company_id_idx" ON "InductionTemplate"("company_id");

-- CreateIndex
CREATE INDEX "InductionTemplate_company_id_is_default_idx" ON "InductionTemplate"("company_id", "is_default");

-- CreateIndex
CREATE INDEX "InductionTemplate_company_id_is_published_idx" ON "InductionTemplate"("company_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "InductionTemplate_company_id_name_version_key" ON "InductionTemplate"("company_id", "name", "version");

-- CreateIndex
CREATE INDEX "InductionQuestion_template_id_idx" ON "InductionQuestion"("template_id");

-- CreateIndex
CREATE INDEX "InductionQuestion_template_id_display_order_idx" ON "InductionQuestion"("template_id", "display_order");

-- CreateIndex
CREATE INDEX "SignInRecord_company_id_idx" ON "SignInRecord"("company_id");

-- CreateIndex
CREATE INDEX "SignInRecord_company_id_site_id_idx" ON "SignInRecord"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "SignInRecord_company_id_sign_in_ts_idx" ON "SignInRecord"("company_id", "sign_in_ts");

-- CreateIndex
CREATE INDEX "SignInRecord_company_id_sign_out_ts_idx" ON "SignInRecord"("company_id", "sign_out_ts");

-- CreateIndex
CREATE INDEX "SignInRecord_site_id_sign_in_ts_idx" ON "SignInRecord"("site_id", "sign_in_ts");

-- CreateIndex
CREATE INDEX "SignInRecord_sign_out_token_idx" ON "SignInRecord"("sign_out_token");

-- CreateIndex
CREATE UNIQUE INDEX "InductionResponse_sign_in_record_id_key" ON "InductionResponse"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "InductionResponse_template_id_idx" ON "InductionResponse"("template_id");

-- CreateIndex
CREATE INDEX "InductionResponse_sign_in_record_id_idx" ON "InductionResponse"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "Contractor_company_id_idx" ON "Contractor"("company_id");

-- CreateIndex
CREATE INDEX "Contractor_company_id_is_active_idx" ON "Contractor"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_company_id_name_key" ON "Contractor"("company_id", "name");

-- CreateIndex
CREATE INDEX "ContractorDocument_contractor_id_idx" ON "ContractorDocument"("contractor_id");

-- CreateIndex
CREATE INDEX "ContractorDocument_contractor_id_expires_at_idx" ON "ContractorDocument"("contractor_id", "expires_at");

-- CreateIndex
CREATE INDEX "ContractorDocument_expires_at_idx" ON "ContractorDocument"("expires_at");

-- CreateIndex
CREATE INDEX "ExportJob_company_id_idx" ON "ExportJob"("company_id");

-- CreateIndex
CREATE INDEX "ExportJob_company_id_status_idx" ON "ExportJob"("company_id", "status");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "ExportJob_expires_at_idx" ON "ExportJob"("expires_at");

-- CreateIndex
CREATE INDEX "AuditLog_company_id_idx" ON "AuditLog"("company_id");

-- CreateIndex
CREATE INDEX "AuditLog_company_id_created_at_idx" ON "AuditLog"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_company_id_action_idx" ON "AuditLog"("company_id", "action");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_request_id_idx" ON "AuditLog"("request_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_induction_template_id_fkey" FOREIGN KEY ("induction_template_id") REFERENCES "InductionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePublicLink" ADD CONSTRAINT "SitePublicLink_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionTemplate" ADD CONSTRAINT "InductionTemplate_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionQuestion" ADD CONSTRAINT "InductionQuestion_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "InductionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInRecord" ADD CONSTRAINT "SignInRecord_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInRecord" ADD CONSTRAINT "SignInRecord_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionResponse" ADD CONSTRAINT "InductionResponse_sign_in_record_id_fkey" FOREIGN KEY ("sign_in_record_id") REFERENCES "SignInRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionResponse" ADD CONSTRAINT "InductionResponse_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "InductionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
