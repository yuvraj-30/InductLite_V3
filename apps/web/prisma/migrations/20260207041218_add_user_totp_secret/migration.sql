-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SITE_MANAGER';

-- AlterTable
ALTER TABLE "ExportJob" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lock_token" TEXT,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totp_secret" TEXT;

-- CreateTable
CREATE TABLE "SiteManagerAssignment" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteManagerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteManagerAssignment_company_id_idx" ON "SiteManagerAssignment"("company_id");

-- CreateIndex
CREATE INDEX "SiteManagerAssignment_company_id_user_id_idx" ON "SiteManagerAssignment"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "SiteManagerAssignment_company_id_site_id_idx" ON "SiteManagerAssignment"("company_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "SiteManagerAssignment_company_id_site_id_user_id_key" ON "SiteManagerAssignment"("company_id", "site_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLinkToken_token_hash_key" ON "MagicLinkToken"("token_hash");

-- CreateIndex
CREATE INDEX "MagicLinkToken_company_id_idx" ON "MagicLinkToken"("company_id");

-- CreateIndex
CREATE INDEX "MagicLinkToken_company_id_contractor_id_idx" ON "MagicLinkToken"("company_id", "contractor_id");

-- CreateIndex
CREATE INDEX "MagicLinkToken_expires_at_idx" ON "MagicLinkToken"("expires_at");

-- CreateIndex
CREATE INDEX "ExportJob_status_run_at_idx" ON "ExportJob"("status", "run_at");

-- CreateIndex
CREATE INDEX "ExportJob_locked_at_idx" ON "ExportJob"("locked_at");

-- AddForeignKey
ALTER TABLE "SiteManagerAssignment" ADD CONSTRAINT "SiteManagerAssignment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteManagerAssignment" ADD CONSTRAINT "SiteManagerAssignment_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteManagerAssignment" ADD CONSTRAINT "SiteManagerAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
