-- CreateEnum
CREATE TYPE "EvacuationEventStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvacuationAttendanceStatus" AS ENUM ('ACCOUNTED', 'MISSING');

-- CreateTable
CREATE TABLE "EvacuationEvent" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "EvacuationEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "notes" TEXT,
    "total_people" INTEGER NOT NULL DEFAULT 0,
    "accounted_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvacuationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvacuationAttendance" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sign_in_record_id" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "visitor_type" "VisitorType" NOT NULL,
    "status" "EvacuationAttendanceStatus" NOT NULL DEFAULT 'MISSING',
    "accounted_at" TIMESTAMP(3),
    "accounted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvacuationAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvacuationEvent_company_id_idx" ON "EvacuationEvent"("company_id");

-- CreateIndex
CREATE INDEX "EvacuationEvent_company_id_site_id_status_idx" ON "EvacuationEvent"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "EvacuationEvent_company_id_started_at_idx" ON "EvacuationEvent"("company_id", "started_at");

-- CreateIndex
CREATE INDEX "EvacuationEvent_started_by_idx" ON "EvacuationEvent"("started_by");

-- CreateIndex
CREATE INDEX "EvacuationEvent_closed_by_idx" ON "EvacuationEvent"("closed_by");

-- CreateIndex
CREATE INDEX "EvacuationAttendance_company_id_idx" ON "EvacuationAttendance"("company_id");

-- CreateIndex
CREATE INDEX "EvacuationAttendance_company_id_event_id_idx" ON "EvacuationAttendance"("company_id", "event_id");

-- CreateIndex
CREATE INDEX "EvacuationAttendance_company_id_site_id_status_idx" ON "EvacuationAttendance"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "EvacuationAttendance_sign_in_record_id_idx" ON "EvacuationAttendance"("sign_in_record_id");

-- CreateIndex
CREATE INDEX "EvacuationAttendance_accounted_by_idx" ON "EvacuationAttendance"("accounted_by");

-- CreateIndex
CREATE UNIQUE INDEX "EvacuationAttendance_event_id_sign_in_record_id_key" ON "EvacuationAttendance"("event_id", "sign_in_record_id");

-- AddForeignKey
ALTER TABLE "EvacuationEvent" ADD CONSTRAINT "EvacuationEvent_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationEvent" ADD CONSTRAINT "EvacuationEvent_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationEvent" ADD CONSTRAINT "EvacuationEvent_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationEvent" ADD CONSTRAINT "EvacuationEvent_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationAttendance" ADD CONSTRAINT "EvacuationAttendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationAttendance" ADD CONSTRAINT "EvacuationAttendance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationAttendance" ADD CONSTRAINT "EvacuationAttendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "EvacuationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationAttendance" ADD CONSTRAINT "EvacuationAttendance_sign_in_record_id_fkey" FOREIGN KEY ("sign_in_record_id") REFERENCES "SignInRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationAttendance" ADD CONSTRAINT "EvacuationAttendance_accounted_by_fkey" FOREIGN KEY ("accounted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
