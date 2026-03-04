-- AlterTable
ALTER TABLE "InductionTemplate"
ADD COLUMN "quiz_scoring_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "quiz_pass_threshold" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN "quiz_max_attempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "quiz_cooldown_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "quiz_required_for_entry" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "InductionQuizAttempt" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "visitor_phone_hash" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "cooldown_until" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "last_score_percent" INTEGER,
    "last_passed" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InductionQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InductionQuizAttempt_company_id_site_id_template_id_visitor_phone_hash_key" ON "InductionQuizAttempt"("company_id", "site_id", "template_id", "visitor_phone_hash");

-- CreateIndex
CREATE INDEX "InductionQuizAttempt_company_id_idx" ON "InductionQuizAttempt"("company_id");

-- CreateIndex
CREATE INDEX "InductionQuizAttempt_company_id_site_id_template_id_idx" ON "InductionQuizAttempt"("company_id", "site_id", "template_id");

-- CreateIndex
CREATE INDEX "InductionQuizAttempt_company_id_cooldown_until_idx" ON "InductionQuizAttempt"("company_id", "cooldown_until");

-- AddForeignKey
ALTER TABLE "InductionQuizAttempt" ADD CONSTRAINT "InductionQuizAttempt_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionQuizAttempt" ADD CONSTRAINT "InductionQuizAttempt_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InductionQuizAttempt" ADD CONSTRAINT "InductionQuizAttempt_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "InductionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;