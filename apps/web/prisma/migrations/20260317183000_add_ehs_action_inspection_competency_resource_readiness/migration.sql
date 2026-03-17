-- CreateEnum
CREATE TYPE "ActionSourceType" AS ENUM ('MANUAL', 'INCIDENT', 'HAZARD', 'PERMIT', 'EMERGENCY', 'INSPECTION', 'COMPETENCY', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompetencyEvidenceType" AS ENUM ('INDUCTION', 'CERTIFICATION', 'DOCUMENT', 'LMS', 'OTHER');

-- CreateEnum
CREATE TYPE "CompetencyCertificationStatus" AS ENUM ('CURRENT', 'EXPIRING', 'EXPIRED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "CompetencyDecisionStatus" AS ENUM ('CLEAR', 'EXPIRING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ResourceReadinessStatus" AS ENUM ('READY', 'REVIEW_REQUIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ResourceInspectionStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "InspectionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'AD_HOC');

-- CreateEnum
CREATE TYPE "InspectionRunStatus" AS ENUM ('COMPLETED', 'MISSED');

-- AlterTable
ALTER TABLE "BookableResource"
ADD COLUMN "blocked_reason" TEXT,
ADD COLUMN "inspection_due_at" TIMESTAMP(3),
ADD COLUMN "last_compliance_check_at" TIMESTAMP(3),
ADD COLUMN "readiness_status" "ResourceReadinessStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN "service_due_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActionRegisterEntry" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "source_type" "ActionSourceType" NOT NULL DEFAULT 'MANUAL',
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "owner_user_id" TEXT,
    "reported_by_user_id" TEXT,
    "due_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by_user_id" TEXT,
    "evidence_refs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionComment" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyRequirement" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "role_key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "evidence_type" "CompetencyEvidenceType" NOT NULL DEFAULT 'CERTIFICATION',
    "validity_days" INTEGER,
    "is_blocking" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerCertification" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "requirement_id" TEXT,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" TEXT,
    "worker_name" TEXT NOT NULL,
    "employer_name" TEXT,
    "status" "CompetencyCertificationStatus" NOT NULL DEFAULT 'CURRENT',
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "evidence_refs" JSONB,
    "verified_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyDecision" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sign_in_record_id" TEXT,
    "visitor_phone" TEXT NOT NULL,
    "status" "CompetencyDecisionStatus" NOT NULL,
    "blocked_reason" TEXT,
    "summary" JSONB,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceInspectionRecord" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "status" "ResourceInspectionStatus" NOT NULL DEFAULT 'PASS',
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspected_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceInspectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionSchedule" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "InspectionFrequency" NOT NULL DEFAULT 'WEEKLY',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "next_due_at" TIMESTAMP(3) NOT NULL,
    "assigned_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRun" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "performed_by_user_id" TEXT,
    "status" "InspectionRunStatus" NOT NULL DEFAULT 'COMPLETED',
    "score_percent" INTEGER,
    "failed_item_count" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookableResource_company_id_readiness_status_idx" ON "BookableResource"("company_id", "readiness_status");

-- CreateIndex
CREATE INDEX "BookableResource_company_id_inspection_due_at_idx" ON "BookableResource"("company_id", "inspection_due_at");

-- CreateIndex
CREATE INDEX "BookableResource_company_id_service_due_at_idx" ON "BookableResource"("company_id", "service_due_at");

-- CreateIndex
CREATE INDEX "ActionRegisterEntry_company_id_idx" ON "ActionRegisterEntry"("company_id");

-- CreateIndex
CREATE INDEX "ActionRegisterEntry_company_id_site_id_status_idx" ON "ActionRegisterEntry"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "ActionRegisterEntry_company_id_source_type_source_id_idx" ON "ActionRegisterEntry"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "ActionRegisterEntry_company_id_owner_user_id_status_idx" ON "ActionRegisterEntry"("company_id", "owner_user_id", "status");

-- CreateIndex
CREATE INDEX "ActionRegisterEntry_company_id_due_at_status_idx" ON "ActionRegisterEntry"("company_id", "due_at", "status");

-- CreateIndex
CREATE INDEX "ActionComment_company_id_idx" ON "ActionComment"("company_id");

-- CreateIndex
CREATE INDEX "ActionComment_company_id_action_id_created_at_idx" ON "ActionComment"("company_id", "action_id", "created_at");

-- CreateIndex
CREATE INDEX "CompetencyRequirement_company_id_idx" ON "CompetencyRequirement"("company_id");

-- CreateIndex
CREATE INDEX "CompetencyRequirement_company_id_site_id_is_active_idx" ON "CompetencyRequirement"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "CompetencyRequirement_company_id_role_key_is_active_idx" ON "CompetencyRequirement"("company_id", "role_key", "is_active");

-- CreateIndex
CREATE INDEX "WorkerCertification_company_id_idx" ON "WorkerCertification"("company_id");

-- CreateIndex
CREATE INDEX "WorkerCertification_company_id_site_id_status_expires_at_idx" ON "WorkerCertification"("company_id", "site_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "WorkerCertification_company_id_visitor_phone_expires_at_idx" ON "WorkerCertification"("company_id", "visitor_phone", "expires_at");

-- CreateIndex
CREATE INDEX "WorkerCertification_company_id_requirement_id_visitor_phone_idx" ON "WorkerCertification"("company_id", "requirement_id", "visitor_phone");

-- CreateIndex
CREATE INDEX "CompetencyDecision_company_id_idx" ON "CompetencyDecision"("company_id");

-- CreateIndex
CREATE INDEX "CompetencyDecision_company_id_site_id_status_decided_at_idx" ON "CompetencyDecision"("company_id", "site_id", "status", "decided_at");

-- CreateIndex
CREATE INDEX "CompetencyDecision_company_id_visitor_phone_decided_at_idx" ON "CompetencyDecision"("company_id", "visitor_phone", "decided_at");

-- CreateIndex
CREATE INDEX "CompetencyDecision_sign_in_record_id_idx" ON "CompetencyDecision"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "ResourceInspectionRecord_company_id_idx" ON "ResourceInspectionRecord"("company_id");

-- CreateIndex
CREATE INDEX "ResourceInspectionRecord_company_id_site_id_inspected_at_idx" ON "ResourceInspectionRecord"("company_id", "site_id", "inspected_at");

-- CreateIndex
CREATE INDEX "ResourceInspectionRecord_company_id_resource_id_inspected_at_idx" ON "ResourceInspectionRecord"("company_id", "resource_id", "inspected_at");

-- CreateIndex
CREATE INDEX "InspectionSchedule_company_id_idx" ON "InspectionSchedule"("company_id");

-- CreateIndex
CREATE INDEX "InspectionSchedule_company_id_site_id_is_active_idx" ON "InspectionSchedule"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "InspectionSchedule_company_id_next_due_at_is_active_idx" ON "InspectionSchedule"("company_id", "next_due_at", "is_active");

-- CreateIndex
CREATE INDEX "InspectionRun_company_id_idx" ON "InspectionRun"("company_id");

-- CreateIndex
CREATE INDEX "InspectionRun_company_id_site_id_completed_at_idx" ON "InspectionRun"("company_id", "site_id", "completed_at");

-- CreateIndex
CREATE INDEX "InspectionRun_company_id_schedule_id_completed_at_idx" ON "InspectionRun"("company_id", "schedule_id", "completed_at");
