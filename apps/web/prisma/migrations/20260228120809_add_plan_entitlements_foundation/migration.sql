-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('STANDARD', 'PLUS', 'PRO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "feature_credit_overrides" JSONB,
ADD COLUMN     "feature_overrides" JSONB,
ADD COLUMN     "product_plan" "CompanyPlan" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "feature_credit_overrides" JSONB,
ADD COLUMN     "feature_overrides" JSONB;
