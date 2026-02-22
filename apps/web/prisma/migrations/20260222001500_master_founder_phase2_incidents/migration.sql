-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('INCIDENT', 'NEAR_MISS');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED');

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sign_in_record_id" TEXT,
    "incident_type" "IncidentType" NOT NULL DEFAULT 'INCIDENT',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "immediate_actions" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reported_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_idx" ON "IncidentReport"("company_id");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_site_id_idx" ON "IncidentReport"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_status_idx" ON "IncidentReport"("company_id", "status");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_incident_type_idx" ON "IncidentReport"("company_id", "incident_type");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_severity_idx" ON "IncidentReport"("company_id", "severity");

-- CreateIndex
CREATE INDEX "IncidentReport_company_id_occurred_at_idx" ON "IncidentReport"("company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "IncidentReport_sign_in_record_id_idx" ON "IncidentReport"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "IncidentReport_reported_by_idx" ON "IncidentReport"("reported_by");

-- CreateIndex
CREATE INDEX "IncidentReport_resolved_by_idx" ON "IncidentReport"("resolved_by");

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_sign_in_record_id_fkey" FOREIGN KEY ("sign_in_record_id") REFERENCES "SignInRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
