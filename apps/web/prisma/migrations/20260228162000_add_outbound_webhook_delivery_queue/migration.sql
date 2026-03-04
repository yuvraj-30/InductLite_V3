-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRYING', 'SENT', 'DEAD');

-- CreateTable
CREATE TABLE "OutboundWebhookDelivery" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3),
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "last_response_body" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundWebhookDelivery_company_id_idx" ON "OutboundWebhookDelivery"("company_id");

-- CreateIndex
CREATE INDEX "OutboundWebhookDelivery_company_id_status_idx" ON "OutboundWebhookDelivery"("company_id", "status");

-- CreateIndex
CREATE INDEX "OutboundWebhookDelivery_status_next_attempt_at_idx" ON "OutboundWebhookDelivery"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "OutboundWebhookDelivery_site_id_status_idx" ON "OutboundWebhookDelivery"("site_id", "status");

-- CreateIndex
CREATE INDEX "OutboundWebhookDelivery_created_at_idx" ON "OutboundWebhookDelivery"("created_at");

-- AddForeignKey
ALTER TABLE "OutboundWebhookDelivery" ADD CONSTRAINT "OutboundWebhookDelivery_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundWebhookDelivery" ADD CONSTRAINT "OutboundWebhookDelivery_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
