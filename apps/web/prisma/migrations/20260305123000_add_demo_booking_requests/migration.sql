-- CreateEnum
CREATE TYPE "DemoBookingNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "DemoBookingRequest" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "work_email" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "phone" TEXT,
    "site_count" INTEGER,
    "target_go_live_date" TIMESTAMP(3),
    "requirements" TEXT NOT NULL,
    "source_path" TEXT NOT NULL DEFAULT '/demo',
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "notification_status" "DemoBookingNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "notification_recipients" JSONB,
    "notification_attempted_at" TIMESTAMP(3),
    "notification_sent_at" TIMESTAMP(3),
    "notification_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoBookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoBookingRequest_created_at_idx" ON "DemoBookingRequest"("created_at");

-- CreateIndex
CREATE INDEX "DemoBookingRequest_notification_status_created_at_idx" ON "DemoBookingRequest"("notification_status", "created_at");
