/*
  Warnings:

  - You are about to drop the column `induction_template_id` on the `Site` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Site" DROP CONSTRAINT "Site_induction_template_id_fkey";

-- DropIndex
DROP INDEX "InductionTemplate_company_id_is_default_idx";

-- DropIndex
DROP INDEX "InductionTemplate_company_id_is_published_idx";

-- AlterTable
ALTER TABLE "InductionTemplate" ADD COLUMN     "site_id" TEXT;

-- AlterTable
ALTER TABLE "SignInRecord" ADD COLUMN     "signed_out_by" TEXT;

-- AlterTable
ALTER TABLE "Site" DROP COLUMN "induction_template_id";

-- CreateIndex
CREATE INDEX "InductionTemplate_company_id_site_id_idx" ON "InductionTemplate"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "InductionTemplate_company_id_is_default_is_published_idx" ON "InductionTemplate"("company_id", "is_default", "is_published");

-- CreateIndex
CREATE INDEX "InductionTemplate_site_id_is_published_idx" ON "InductionTemplate"("site_id", "is_published");

-- AddForeignKey
ALTER TABLE "InductionTemplate" ADD CONSTRAINT "InductionTemplate_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInRecord" ADD CONSTRAINT "SignInRecord_signed_out_by_fkey" FOREIGN KEY ("signed_out_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
