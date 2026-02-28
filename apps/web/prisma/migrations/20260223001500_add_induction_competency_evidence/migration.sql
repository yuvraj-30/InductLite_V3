-- CreateEnum
CREATE TYPE "InductionCompetencyStatus" AS ENUM ('SELF_DECLARED', 'SUPERVISOR_APPROVED');

-- AlterTable
ALTER TABLE "InductionResponse"
ADD COLUMN "briefing_acknowledged_at" TIMESTAMP(3),
ADD COLUMN "competency_status" "InductionCompetencyStatus" NOT NULL DEFAULT 'SELF_DECLARED',
ADD COLUMN "refresher_due_at" TIMESTAMP(3),
ADD COLUMN "supervisor_verified_at" TIMESTAMP(3),
ADD COLUMN "supervisor_verified_by" TEXT;

-- CreateIndex
CREATE INDEX "InductionResponse_competency_status_idx" ON "InductionResponse"("competency_status");

-- CreateIndex
CREATE INDEX "InductionResponse_refresher_due_at_idx" ON "InductionResponse"("refresher_due_at");

-- CreateIndex
CREATE INDEX "InductionResponse_supervisor_verified_by_idx" ON "InductionResponse"("supervisor_verified_by");
