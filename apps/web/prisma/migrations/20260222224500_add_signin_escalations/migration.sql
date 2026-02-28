-- CreateEnum
CREATE TYPE "SignInEscalationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "PendingSignInEscalation" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "SignInEscalationStatus" NOT NULL DEFAULT 'PENDING',
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" TEXT,
    "employer_name" TEXT,
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'CONTRACTOR',
    "role_on_site" TEXT,
    "hasAcceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "terms_version_id" TEXT,
    "privacy_version_id" TEXT,
    "consent_statement" TEXT,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "signature_data" TEXT,
    "red_flag_question_ids" JSONB NOT NULL,
    "red_flag_questions" JSONB NOT NULL,
    "notification_targets" INTEGER NOT NULL DEFAULT 0,
    "notifications_queued" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_notes" TEXT,
    "approved_sign_in_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSignInEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignInEscalation_company_id_idempotency_key_key" ON "PendingSignInEscalation"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignInEscalation_approved_sign_in_record_id_key" ON "PendingSignInEscalation"("approved_sign_in_record_id");

-- CreateIndex
CREATE INDEX "PendingSignInEscalation_company_id_idx" ON "PendingSignInEscalation"("company_id");

-- CreateIndex
CREATE INDEX "PendingSignInEscalation_company_id_status_idx" ON "PendingSignInEscalation"("company_id", "status");

-- CreateIndex
CREATE INDEX "PendingSignInEscalation_company_id_site_id_status_idx" ON "PendingSignInEscalation"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "PendingSignInEscalation_company_id_submitted_at_idx" ON "PendingSignInEscalation"("company_id", "submitted_at");

-- CreateIndex
CREATE INDEX "PendingSignInEscalation_reviewed_by_idx" ON "PendingSignInEscalation"("reviewed_by");

-- AddForeignKey
ALTER TABLE "PendingSignInEscalation" ADD CONSTRAINT "PendingSignInEscalation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSignInEscalation" ADD CONSTRAINT "PendingSignInEscalation_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSignInEscalation" ADD CONSTRAINT "PendingSignInEscalation_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSignInEscalation" ADD CONSTRAINT "PendingSignInEscalation_approved_sign_in_record_id_fkey" FOREIGN KEY ("approved_sign_in_record_id") REFERENCES "SignInRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
