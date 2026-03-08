-- Native mobile runtime hardening + OCR + provider connector foundation.

CREATE TABLE IF NOT EXISTS "DeviceSubscription" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT,
  "user_id" TEXT,
  "endpoint" TEXT NOT NULL,
  "public_key" TEXT NOT NULL,
  "auth_key" TEXT NOT NULL,
  "platform" TEXT,
  "token_version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeviceSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceSubscription_endpoint_key"
ON "DeviceSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "DeviceSubscription_company_id_idx"
ON "DeviceSubscription"("company_id");

CREATE INDEX IF NOT EXISTS "DeviceSubscription_company_id_site_id_is_active_idx"
ON "DeviceSubscription"("company_id", "site_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DeviceSubscription'
      AND column_name = 'token_version'
  ) THEN
    ALTER TABLE "DeviceSubscription"
    ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

CREATE TYPE "MobileRuntimeEventType" AS ENUM ('ENROLLMENT', 'GEOFENCE', 'HEARTBEAT', 'BOOTSTRAP');
CREATE TYPE "MobileRuntimeEventStatus" AS ENUM ('ACCEPTED', 'DUPLICATE', 'REJECTED', 'ERROR');

CREATE TABLE "MobileDeviceRuntimeEvent" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT,
  "device_subscription_id" TEXT,
  "event_type" "MobileRuntimeEventType" NOT NULL,
  "event_status" "MobileRuntimeEventStatus" NOT NULL DEFAULT 'ACCEPTED',
  "correlation_id" TEXT,
  "runtime_tag" TEXT,
  "reason" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MobileDeviceRuntimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MobileDeviceRuntimeEvent_company_id_idx"
ON "MobileDeviceRuntimeEvent"("company_id");

CREATE INDEX "MobileDeviceRuntimeEvent_company_id_event_type_created_at_idx"
ON "MobileDeviceRuntimeEvent"("company_id", "event_type", "created_at");

CREATE INDEX "MobileDeviceRuntimeEvent_company_id_site_id_event_type_created_at_idx"
ON "MobileDeviceRuntimeEvent"("company_id", "site_id", "event_type", "created_at");

CREATE INDEX "MobileDeviceRuntimeEvent_company_id_device_subscription_id_created_at_idx"
ON "MobileDeviceRuntimeEvent"("company_id", "device_subscription_id", "created_at");

CREATE TYPE "IdentityOcrStatus" AS ENUM ('PENDING', 'APPROVED', 'REVIEW', 'REJECTED', 'ERROR');

CREATE TABLE "IdentityOcrVerification" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "sign_in_record_id" TEXT,
  "identity_verification_record_id" TEXT,
  "provider" TEXT NOT NULL,
  "document_type" TEXT,
  "decision_mode" TEXT NOT NULL,
  "decision_status" "IdentityOcrStatus" NOT NULL DEFAULT 'PENDING',
  "confidence_score" DOUBLE PRECISION,
  "name_match_score" DOUBLE PRECISION,
  "extracted_name" TEXT,
  "extracted_document_number_hash" TEXT,
  "extracted_expiry_date" TIMESTAMP(3),
  "reason_code" TEXT,
  "request_metadata" JSONB,
  "response_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdentityOcrVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityOcrVerification_company_id_idx"
ON "IdentityOcrVerification"("company_id");

CREATE INDEX "IdentityOcrVerification_company_id_site_id_created_at_idx"
ON "IdentityOcrVerification"("company_id", "site_id", "created_at");

CREATE INDEX "IdentityOcrVerification_company_id_decision_status_created_at_idx"
ON "IdentityOcrVerification"("company_id", "decision_status", "created_at");

CREATE INDEX "IdentityOcrVerification_sign_in_record_id_idx"
ON "IdentityOcrVerification"("sign_in_record_id");

CREATE TYPE "AccessConnectorProvider" AS ENUM ('GENERIC', 'HID_ORIGO', 'BRIVO');
CREATE TYPE "AccessConnectorHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'OUTAGE', 'RESTORED');

CREATE TABLE "AccessConnectorConfig" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT,
  "provider" "AccessConnectorProvider" NOT NULL,
  "endpoint_url" TEXT NOT NULL,
  "auth_token_encrypted" TEXT,
  "settings" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccessConnectorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessConnectorConfig_company_id_site_id_provider_key"
ON "AccessConnectorConfig"("company_id", "site_id", "provider");

CREATE INDEX "AccessConnectorConfig_company_id_idx"
ON "AccessConnectorConfig"("company_id");

CREATE INDEX "AccessConnectorConfig_company_id_site_id_is_active_idx"
ON "AccessConnectorConfig"("company_id", "site_id", "is_active");

CREATE INDEX "AccessConnectorConfig_company_id_provider_is_active_idx"
ON "AccessConnectorConfig"("company_id", "provider", "is_active");

CREATE TABLE "AccessConnectorHealthEvent" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "site_id" TEXT,
  "connector_config_id" TEXT,
  "provider" "AccessConnectorProvider" NOT NULL,
  "status" "AccessConnectorHealthStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "details" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccessConnectorHealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessConnectorHealthEvent_company_id_idx"
ON "AccessConnectorHealthEvent"("company_id");

CREATE INDEX "AccessConnectorHealthEvent_company_id_provider_occurred_at_idx"
ON "AccessConnectorHealthEvent"("company_id", "provider", "occurred_at");

CREATE INDEX "AccessConnectorHealthEvent_company_id_site_id_occurred_at_idx"
ON "AccessConnectorHealthEvent"("company_id", "site_id", "occurred_at");

CREATE INDEX "AccessConnectorHealthEvent_connector_config_id_idx"
ON "AccessConnectorHealthEvent"("connector_config_id");
