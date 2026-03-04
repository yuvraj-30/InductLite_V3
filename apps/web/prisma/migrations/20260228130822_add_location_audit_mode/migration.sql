-- AlterTable
ALTER TABLE "SignInRecord" ADD COLUMN     "location_accuracy_m" DOUBLE PRECISION,
ADD COLUMN     "location_captured_at" TIMESTAMP(3),
ADD COLUMN     "location_distance_m" DOUBLE PRECISION,
ADD COLUMN     "location_latitude" DOUBLE PRECISION,
ADD COLUMN     "location_longitude" DOUBLE PRECISION,
ADD COLUMN     "location_within_radius" BOOLEAN;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "location_latitude" DOUBLE PRECISION,
ADD COLUMN     "location_longitude" DOUBLE PRECISION,
ADD COLUMN     "location_radius_m" INTEGER;
