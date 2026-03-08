-- CreateEnum
CREATE TYPE "DeliveryItemStatus" AS ENUM ('ARRIVED', 'NOTIFIED', 'COLLECTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryEventType" AS ENUM ('ARRIVED', 'NOTIFIED', 'STATUS_CHANGED', 'NOTE', 'COLLECTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DESK', 'ROOM', 'VEHICLE', 'TOOL', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourceBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "sender_name" TEXT,
    "carrier_name" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "intended_for" TEXT,
    "status" "DeliveryItemStatus" NOT NULL DEFAULT 'ARRIVED',
    "notes" TEXT,
    "sla_due_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),
    "collected_at" TIMESTAMP(3),
    "collected_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_item_id" TEXT NOT NULL,
    "event_type" "DeliveryEventType" NOT NULL,
    "message" TEXT,
    "status_from" "DeliveryItemStatus",
    "status_to" "DeliveryItemStatus",
    "actor_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookableResource" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL DEFAULT 'OTHER',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "location_label" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookableResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceBooking" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "booked_by_user_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "ResourceBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryItem_company_id_reference_code_key" ON "DeliveryItem"("company_id", "reference_code");

-- CreateIndex
CREATE INDEX "DeliveryItem_company_id_idx" ON "DeliveryItem"("company_id");

-- CreateIndex
CREATE INDEX "DeliveryItem_company_id_site_id_status_idx" ON "DeliveryItem"("company_id", "site_id", "status");

-- CreateIndex
CREATE INDEX "DeliveryItem_company_id_arrived_at_idx" ON "DeliveryItem"("company_id", "arrived_at");

-- CreateIndex
CREATE INDEX "DeliveryEvent_company_id_idx" ON "DeliveryEvent"("company_id");

-- CreateIndex
CREATE INDEX "DeliveryEvent_company_id_delivery_item_id_created_at_idx" ON "DeliveryEvent"("company_id", "delivery_item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "BookableResource_company_id_site_id_name_key" ON "BookableResource"("company_id", "site_id", "name");

-- CreateIndex
CREATE INDEX "BookableResource_company_id_idx" ON "BookableResource"("company_id");

-- CreateIndex
CREATE INDEX "BookableResource_company_id_site_id_is_active_idx" ON "BookableResource"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "ResourceBooking_company_id_idx" ON "ResourceBooking"("company_id");

-- CreateIndex
CREATE INDEX "ResourceBooking_company_id_site_id_starts_at_idx" ON "ResourceBooking"("company_id", "site_id", "starts_at");

-- CreateIndex
CREATE INDEX "ResourceBooking_company_id_resource_id_starts_at_idx" ON "ResourceBooking"("company_id", "resource_id", "starts_at");

-- CreateIndex
CREATE INDEX "ResourceBooking_company_id_status_starts_at_idx" ON "ResourceBooking"("company_id", "status", "starts_at");
