-- CreateEnum
CREATE TYPE "EmergencyDrillType" AS ENUM ('EVACUATION', 'FIRE', 'EARTHQUAKE', 'MEDICAL', 'OTHER');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "compliance_legal_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "compliance_legal_hold_reason" TEXT,
ADD COLUMN     "compliance_legal_hold_set_at" TIMESTAMP(3),
ADD COLUMN     "emergency_drill_retention_days" INTEGER NOT NULL DEFAULT 1825,
ADD COLUMN     "incident_retention_days" INTEGER NOT NULL DEFAULT 1825;

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN     "is_notifiable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legal_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retention_expires_at" TIMESTAMP(3),
ADD COLUMN     "worksafe_notified_at" TIMESTAMP(3),
ADD COLUMN     "worksafe_notified_by" TEXT,
ADD COLUMN     "worksafe_reference_number" TEXT;

-- CreateTable
CREATE TABLE "EmergencyDrill" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "drill_type" "EmergencyDrillType" NOT NULL DEFAULT 'EVACUATION',
    "scenario" TEXT NOT NULL,
    "outcome_notes" TEXT,
    "follow_up_actions" TEXT,
    "conducted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_due_at" TIMESTAMP(3),
    "tested_by" TEXT,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "retention_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyDrill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyDrill_company_id_idx" ON "EmergencyDrill"("company_id");

-- CreateIndex
CREATE INDEX "EmergencyDrill_company_id_site_id_idx" ON "EmergencyDrill"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "EmergencyDrill_company_id_conducted_at_idx" ON "EmergencyDrill"("company_id", "conducted_at");

-- CreateIndex
CREATE INDEX "EmergencyDrill_company_id_legal_hold_idx" ON "EmergencyDrill"("company_id", "legal_hold");

-- CreateIndex
CREATE INDEX "EmergencyDrill_company_id_retention_expires_at_idx" ON "EmergencyDrill"("company_id", "retention_expires_at");

-- CreateIndex
CREATE INDEX "EmergencyDrill_tested_by_idx" ON "EmergencyDrill"("tested_by");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_is_notifiable_idx" ON "IncidentReport"("company_id", "is_notifiable");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_legal_hold_idx" ON "IncidentReport"("company_id", "legal_hold");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_retention_expires_at_idx" ON "IncidentReport"("company_id", "retention_expires_at");

-- CreateIndex
CREATE INDEX "IncidentReport_worksafe_notified_by_idx" ON "IncidentReport"("worksafe_notified_by");

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_worksafe_notified_by_fkey" FOREIGN KEY ("worksafe_notified_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_tested_by_fkey" FOREIGN KEY ("tested_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
