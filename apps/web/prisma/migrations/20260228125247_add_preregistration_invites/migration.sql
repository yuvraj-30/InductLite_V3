-- CreateTable
CREATE TABLE "PreRegistrationInvite" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "created_by" TEXT,
    "token_hash" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "visitor_phone" TEXT NOT NULL,
    "visitor_email" TEXT,
    "employer_name" TEXT,
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'CONTRACTOR',
    "role_on_site" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_sign_in_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreRegistrationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreRegistrationInvite_token_hash_key" ON "PreRegistrationInvite"("token_hash");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_company_id_idx" ON "PreRegistrationInvite"("company_id");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_company_id_site_id_idx" ON "PreRegistrationInvite"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_company_id_site_id_is_active_idx" ON "PreRegistrationInvite"("company_id", "site_id", "is_active");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_company_id_expires_at_idx" ON "PreRegistrationInvite"("company_id", "expires_at");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_company_id_used_at_idx" ON "PreRegistrationInvite"("company_id", "used_at");

-- CreateIndex
CREATE INDEX "PreRegistrationInvite_created_by_idx" ON "PreRegistrationInvite"("created_by");

-- AddForeignKey
ALTER TABLE "PreRegistrationInvite" ADD CONSTRAINT "PreRegistrationInvite_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreRegistrationInvite" ADD CONSTRAINT "PreRegistrationInvite_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreRegistrationInvite" ADD CONSTRAINT "PreRegistrationInvite_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
