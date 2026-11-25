-- FEAT-2608-036: default-location filter for Events/Venues search
ALTER TABLE "User" ADD COLUMN "defaultCity" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultCityLat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "defaultCityLng" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Venue_city_idx" ON "Venue"("city");
