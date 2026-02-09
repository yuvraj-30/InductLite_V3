ALTER TABLE "InductionTemplate"
ADD COLUMN IF NOT EXISTS "force_reinduction" BOOLEAN NOT NULL DEFAULT false;
