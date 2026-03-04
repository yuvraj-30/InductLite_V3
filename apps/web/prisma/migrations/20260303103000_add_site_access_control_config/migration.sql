-- Add site-level access control configuration for hardware + geofence add-ons.
ALTER TABLE "Site"
ADD COLUMN IF NOT EXISTS "access_control" JSONB;
