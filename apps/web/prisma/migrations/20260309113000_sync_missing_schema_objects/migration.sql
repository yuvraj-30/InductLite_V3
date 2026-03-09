-- CreateEnum
CREATE TYPE "PermitLifecycleStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'DENIED');

-- CreateEnum
CREATE TYPE "PermitApprovalDecision" AS ENUM ('APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "ContractorPrequalificationStatus" AS ENUM ('PENDING', 'APPROVED', 'EXPIRED', 'DENIED');

-- CreateEnum
CREATE TYPE "VisitorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdentityVerificationMethod" AS ENUM ('MANUAL_ID', 'DOCUMENT_SCAN', 'WATCHLIST_REVIEW', 'RANDOM_CHECK');

-- CreateEnum
CREATE TYPE "IdentityVerificationResult" AS ENUM ('PASS', 'FAIL', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "BroadcastSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BroadcastChannel" AS ENUM ('EMAIL', 'SMS', 'WEB_PUSH', 'TEAMS', 'SLACK');

-- CreateEnum
CREATE TYPE "BroadcastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'ACKNOWLEDGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND', 'INBOUND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('TEAMS', 'SLACK');

-- CreateEnum
CREATE TYPE "ChannelDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "PresenceHintStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED', 'AUTO_RESOLVED');

-- CreateEnum
CREATE TYPE "AccessDecisionStatus" AS ENUM ('ALLOW', 'DENY', 'FALLBACK', 'ERROR');

-- CreateEnum
CREATE TYPE "HardwareOutageSeverity" AS ENUM ('DEGRADED', 'OUTAGE', 'RESTORED');

-- CreateEnum
CREATE TYPE "EvidenceSignatureAlgorithm" AS ENUM ('HMAC_SHA256');

-- CreateEnum
CREATE TYPE "PolicySimulationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanChangeRequestStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'APPLIED', 'CANCELED', 'FAILED', 'ROLLED_BACK');

-- AlterTable
ALTER TABLE "BookableResource" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeliveryItem" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ResourceBooking" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PermitTemplate" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "name" TEXT NOT NULL,
    "permit_type" TEXT NOT NULL,
    "description" TEXT,
    "approval_policy" JSONB,
    "is_required_for_signin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitCondition" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "permit_template_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "condition_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitRequest" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "permit_template_id" TEXT NOT NULL,
    "contractor_id" TEXT,
    "requestor_user_id" TEXT,
    "assignee_user_id" TEXT,
    "visitor_name" TEXT,
    "visitor_phone" TEXT,
    "visitor_email" TEXT,
    "employer_name" TEXT,
    "status" "PermitLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "validity_start" TIMESTAMP(3),
    "validity_end" TIMESTAMP(3),
    "notes" TEXT,
    "requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "active_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "sign_in_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitApproval" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "permit_request_id" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "approver_user_id" TEXT NOT NULL,
    "decision" "PermitApprovalDecision" NOT NULL,
    "notes" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorPrequalification" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "site_id" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "ContractorPrequalificationStatus" NOT NULL DEFAULT 'PENDING',
    "checklist" JSONB,
    "evidence_refs" JSONB,
    "expires_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorPrequalification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorApprovalPolicy" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "template_id" TEXT,
    "name" TEXT NOT NULL,
    "rules" JSONB,
    "random_check_percentage" INTEGER NOT NULL DEFAULT 0,
    "require_watchlist_screening" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorApprovalRequest" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT,
    "visitor_email" TEXT,
    "employer_name" TEXT,
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'CONTRACTOR',
    "reason" TEXT NOT NULL,
    "policy_id" TEXT,
    "status" "VisitorApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "decision_notes" TEXT,
    "channel_action_token_hash" TEXT,
    "sign_in_record_id" TEXT,
    "pending_sign_in_escalation_id" TEXT,
    "random_check_triggered" BOOLEAN NOT NULL DEFAULT false,
    "watchlist_match" BOOLEAN NOT NULL DEFAULT false,
    "watchlist_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorWatchlistEntry" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "employer_name" TEXT,
    "normalized_name" TEXT NOT NULL,
    "normalized_phone" TEXT,
    "normalized_email" TEXT,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorWatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityVerificationRecord" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "visitor_approval_request_id" TEXT,
    "sign_in_record_id" TEXT,
    "method" "IdentityVerificationMethod" NOT NULL,
    "reviewer_user_id" TEXT,
    "evidence_pointer" TEXT,
    "result" "IdentityVerificationResult" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyBroadcast" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "severity" "BroadcastSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "acknowledgement_required" BOOLEAN NOT NULL DEFAULT true,
    "initiated_by" TEXT,
    "scope" JSONB,
    "channels" JSONB,
    "expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "recipient_name" TEXT,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "recipient_user_id" TEXT,
    "channel" "BroadcastChannel" NOT NULL,
    "status" "BroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "ack_token_hash" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationEvent" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "broadcast_id" TEXT,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "channel" "BroadcastChannel",
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelIntegrationConfig" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "provider" "ChannelProvider" NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "signing_secret" TEXT,
    "auth_token" TEXT,
    "mappings" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelDelivery" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "integration_config_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChannelDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "response_status_code" INTEGER,
    "response_body" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceHint" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sign_in_record_id" TEXT NOT NULL,
    "hint_type" TEXT NOT NULL,
    "status" "PresenceHintStatus" NOT NULL DEFAULT 'OPEN',
    "hint_payload" JSONB,
    "suggested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresenceHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessDecisionTrace" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sign_in_record_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "decision_status" "AccessDecisionStatus" NOT NULL,
    "reason" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "fallback_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessDecisionTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HardwareOutageEvent" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT,
    "provider" TEXT,
    "severity" "HardwareOutageSeverity" NOT NULL DEFAULT 'DEGRADED',
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HardwareOutageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceManifest" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "export_job_id" TEXT,
    "hash_root" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signer" TEXT,
    "signature_algorithm" "EvidenceSignatureAlgorithm" NOT NULL DEFAULT 'HMAC_SHA256',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceArtifact" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evidence_manifest_id" TEXT NOT NULL,
    "artifact_path" TEXT NOT NULL,
    "artifact_hash" TEXT NOT NULL,
    "artifact_size" INTEGER NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySimulation" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicySimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySimulationRun" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "policy_simulation_id" TEXT NOT NULL,
    "status" "PolicySimulationStatus" NOT NULL DEFAULT 'QUEUED',
    "snapshot_generated_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "requested_by" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicySimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySimulationResult" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "policy_simulation_run_id" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "blocked_entries_estimate" INTEGER NOT NULL,
    "approval_load_estimate" INTEGER NOT NULL,
    "false_positive_estimate" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicySimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorRiskScore" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "site_id" TEXT,
    "current_score" INTEGER NOT NULL DEFAULT 0,
    "components" JSONB,
    "threshold_state" TEXT,
    "last_calculated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoreHistory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_risk_score_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "components" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChangeRequest" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "requested_by" TEXT,
    "target_plan" "CompanyPlan" NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "status" "PlanChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "change_payload" JSONB NOT NULL,
    "rollback_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChangeHistory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan_change_request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_state" JSONB,
    "next_state" JSONB,
    "acted_by" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChangeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermitTemplate_company_id_idx" ON "PermitTemplate"("company_id");

-- CreateIndex
CREATE INDEX "PermitTemplate_company_id_site_id_idx" ON "PermitTemplate"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "PermitTemplate_company_id_is_active_idx" ON "PermitTemplate"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "PermitCondition_company_id_idx" ON "PermitCondition"("company_id");

-- CreateIndex
CREATE INDEX "PermitCondition_company_id_permit_template_id_idx" ON "PermitCondition"("company_id", "permit_template_id");

-- CreateIndex
CREATE INDEX "PermitRequest_company_id_idx" ON "PermitRequest"("company_id");

-- CreateIndex
CREATE INDEX "PermitRequest_company_id_site_id_status_idx" ON "PermitRequest"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "PermitRequest_company_id_permit_template_id_idx" ON "PermitRequest"("company_id", "permit_template_id");

-- CreateIndex
CREATE INDEX "PermitRequest_company_id_validity_end_idx" ON "PermitRequest"("company_id", "validity_end");

-- CreateIndex
CREATE INDEX "PermitRequest_company_id_visitor_phone_idx" ON "PermitRequest"("company_id", "visitor_phone");

-- CreateIndex
CREATE INDEX "PermitRequest_sign_in_record_id_idx" ON "PermitRequest"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "PermitApproval_company_id_idx" ON "PermitApproval"("company_id");

-- CreateIndex
CREATE INDEX "PermitApproval_company_id_permit_request_id_idx" ON "PermitApproval"("company_id", "permit_request_id");

-- CreateIndex
CREATE INDEX "PermitApproval_company_id_approver_user_id_idx" ON "PermitApproval"("company_id", "approver_user_id");

-- CreateIndex
CREATE INDEX "ContractorPrequalification_company_id_idx" ON "ContractorPrequalification"("company_id");

-- CreateIndex
CREATE INDEX "ContractorPrequalification_company_id_status_expires_at_idx" ON "ContractorPrequalification"("company_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPrequalification_company_id_contractor_id_site_id_key" ON "ContractorPrequalification"("company_id", "contractor_id", "site_id");

-- CreateIndex
CREATE INDEX "VisitorApprovalPolicy_company_id_idx" ON "VisitorApprovalPolicy"("company_id");

-- CreateIndex
CREATE INDEX "VisitorApprovalPolicy_company_id_site_id_is_active_idx" ON "VisitorApprovalPolicy"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorApprovalRequest_channel_action_token_hash_key" ON "VisitorApprovalRequest"("channel_action_token_hash");

-- CreateIndex
CREATE INDEX "VisitorApprovalRequest_company_id_idx" ON "VisitorApprovalRequest"("company_id");

-- CreateIndex
CREATE INDEX "VisitorApprovalRequest_company_id_site_id_status_idx" ON "VisitorApprovalRequest"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "VisitorApprovalRequest_company_id_requested_at_idx" ON "VisitorApprovalRequest"("company_id", "requested_at");

-- CreateIndex
CREATE INDEX "VisitorApprovalRequest_watchlist_entry_id_idx" ON "VisitorApprovalRequest"("watchlist_entry_id");

-- CreateIndex
CREATE INDEX "VisitorWatchlistEntry_company_id_idx" ON "VisitorWatchlistEntry"("company_id");

-- CreateIndex
CREATE INDEX "VisitorWatchlistEntry_company_id_is_active_expires_at_idx" ON "VisitorWatchlistEntry"("company_id", "is_active", "expires_at");

-- CreateIndex
CREATE INDEX "VisitorWatchlistEntry_company_id_normalized_name_idx" ON "VisitorWatchlistEntry"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "VisitorWatchlistEntry_company_id_normalized_phone_idx" ON "VisitorWatchlistEntry"("company_id", "normalized_phone");

-- CreateIndex
CREATE INDEX "VisitorWatchlistEntry_company_id_normalized_email_idx" ON "VisitorWatchlistEntry"("company_id", "normalized_email");

-- CreateIndex
CREATE INDEX "IdentityVerificationRecord_company_id_idx" ON "IdentityVerificationRecord"("company_id");

-- CreateIndex
CREATE INDEX "IdentityVerificationRecord_company_id_site_id_created_at_idx" ON "IdentityVerificationRecord"("company_id", "site_id", "created_at");

-- CreateIndex
CREATE INDEX "IdentityVerificationRecord_visitor_approval_request_id_idx" ON "IdentityVerificationRecord"("visitor_approval_request_id");

-- CreateIndex
CREATE INDEX "EmergencyBroadcast_company_id_idx" ON "EmergencyBroadcast"("company_id");

-- CreateIndex
CREATE INDEX "EmergencyBroadcast_company_id_site_id_started_at_idx" ON "EmergencyBroadcast"("company_id", "site_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_ack_token_hash_key" ON "BroadcastRecipient"("ack_token_hash");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_company_id_idx" ON "BroadcastRecipient"("company_id");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_company_id_broadcast_id_status_idx" ON "BroadcastRecipient"("company_id", "broadcast_id", "status");

-- CreateIndex
CREATE INDEX "CommunicationEvent_company_id_idx" ON "CommunicationEvent"("company_id");

-- CreateIndex
CREATE INDEX "CommunicationEvent_company_id_created_at_idx" ON "CommunicationEvent"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "CommunicationEvent_broadcast_id_idx" ON "CommunicationEvent"("broadcast_id");

-- CreateIndex
CREATE INDEX "ChannelIntegrationConfig_company_id_idx" ON "ChannelIntegrationConfig"("company_id");

-- CreateIndex
CREATE INDEX "ChannelIntegrationConfig_company_id_provider_is_active_idx" ON "ChannelIntegrationConfig"("company_id", "provider", "is_active");

-- CreateIndex
CREATE INDEX "ChannelIntegrationConfig_company_id_site_id_is_active_idx" ON "ChannelIntegrationConfig"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelDelivery_idempotency_key_key" ON "ChannelDelivery"("idempotency_key");

-- CreateIndex
CREATE INDEX "ChannelDelivery_company_id_idx" ON "ChannelDelivery"("company_id");

-- CreateIndex
CREATE INDEX "ChannelDelivery_company_id_status_next_attempt_at_idx" ON "ChannelDelivery"("company_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "ChannelDelivery_integration_config_id_idx" ON "ChannelDelivery"("integration_config_id");

-- CreateIndex
CREATE INDEX "PresenceHint_company_id_idx" ON "PresenceHint"("company_id");

-- CreateIndex
CREATE INDEX "PresenceHint_company_id_site_id_status_idx" ON "PresenceHint"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "PresenceHint_sign_in_record_id_idx" ON "PresenceHint"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "AccessDecisionTrace_company_id_idx" ON "AccessDecisionTrace"("company_id");

-- CreateIndex
CREATE INDEX "AccessDecisionTrace_company_id_site_id_requested_at_idx" ON "AccessDecisionTrace"("company_id", "site_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "AccessDecisionTrace_company_id_correlation_id_key" ON "AccessDecisionTrace"("company_id", "correlation_id");

-- CreateIndex
CREATE INDEX "HardwareOutageEvent_company_id_idx" ON "HardwareOutageEvent"("company_id");

-- CreateIndex
CREATE INDEX "HardwareOutageEvent_company_id_site_id_severity_started_at_idx" ON "HardwareOutageEvent"("company_id", "site_id", "severity", "started_at");

-- CreateIndex
CREATE INDEX "EvidenceManifest_company_id_idx" ON "EvidenceManifest"("company_id");

-- CreateIndex
CREATE INDEX "EvidenceManifest_company_id_export_job_id_idx" ON "EvidenceManifest"("company_id", "export_job_id");

-- CreateIndex
CREATE INDEX "EvidenceArtifact_company_id_idx" ON "EvidenceArtifact"("company_id");

-- CreateIndex
CREATE INDEX "EvidenceArtifact_company_id_evidence_manifest_id_idx" ON "EvidenceArtifact"("company_id", "evidence_manifest_id");

-- CreateIndex
CREATE INDEX "PolicySimulation_company_id_idx" ON "PolicySimulation"("company_id");

-- CreateIndex
CREATE INDEX "PolicySimulation_company_id_created_at_idx" ON "PolicySimulation"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "PolicySimulationRun_company_id_idx" ON "PolicySimulationRun"("company_id");

-- CreateIndex
CREATE INDEX "PolicySimulationRun_company_id_status_created_at_idx" ON "PolicySimulationRun"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "PolicySimulationRun_policy_simulation_id_idx" ON "PolicySimulationRun"("policy_simulation_id");

-- CreateIndex
CREATE UNIQUE INDEX "PolicySimulationResult_policy_simulation_run_id_key" ON "PolicySimulationResult"("policy_simulation_run_id");

-- CreateIndex
CREATE INDEX "PolicySimulationResult_company_id_idx" ON "PolicySimulationResult"("company_id");

-- CreateIndex
CREATE INDEX "PolicySimulationResult_company_id_created_at_idx" ON "PolicySimulationResult"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "ContractorRiskScore_company_id_idx" ON "ContractorRiskScore"("company_id");

-- CreateIndex
CREATE INDEX "ContractorRiskScore_company_id_site_id_current_score_idx" ON "ContractorRiskScore"("company_id", "site_id", "current_score");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorRiskScore_company_id_contractor_id_site_id_key" ON "ContractorRiskScore"("company_id", "contractor_id", "site_id");

-- CreateIndex
CREATE INDEX "RiskScoreHistory_company_id_idx" ON "RiskScoreHistory"("company_id");

-- CreateIndex
CREATE INDEX "RiskScoreHistory_contractor_risk_score_id_calculated_at_idx" ON "RiskScoreHistory"("contractor_risk_score_id", "calculated_at");

-- CreateIndex
CREATE INDEX "PlanChangeRequest_company_id_idx" ON "PlanChangeRequest"("company_id");

-- CreateIndex
CREATE INDEX "PlanChangeRequest_company_id_status_effective_at_idx" ON "PlanChangeRequest"("company_id", "status", "effective_at");

-- CreateIndex
CREATE INDEX "PlanChangeHistory_company_id_idx" ON "PlanChangeHistory"("company_id");

-- CreateIndex
CREATE INDEX "PlanChangeHistory_plan_change_request_id_acted_at_idx" ON "PlanChangeHistory"("plan_change_request_id", "acted_at");

-- RenameIndex
ALTER INDEX "IdentityOcrVerification_company_id_decision_status_created_at_i" RENAME TO "IdentityOcrVerification_company_id_decision_status_created__idx";

-- RenameIndex
ALTER INDEX "InductionQuizAttempt_company_id_site_id_template_id_visitor_pho" RENAME TO "InductionQuizAttempt_company_id_site_id_template_id_visitor_key";

-- RenameIndex
ALTER INDEX "MobileDeviceRuntimeEvent_company_id_device_subscription_id_crea" RENAME TO "MobileDeviceRuntimeEvent_company_id_device_subscription_id__idx";

-- RenameIndex
ALTER INDEX "MobileDeviceRuntimeEvent_company_id_site_id_event_type_created_" RENAME TO "MobileDeviceRuntimeEvent_company_id_site_id_event_type_crea_idx";
