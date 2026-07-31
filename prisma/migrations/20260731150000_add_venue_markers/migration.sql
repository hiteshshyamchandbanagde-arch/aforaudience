-- Seat-map cluster #6 (design.md §9.4, session 48/49) - safety/reference
-- markers (gates, fire extinguishers, stage-distance reference points).

CREATE TYPE "VenueMarkerType" AS ENUM ('GATE', 'FIRE_EXTINGUISHER', 'STAGE_DISTANCE_REF');

CREATE TABLE "VenueMarker" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" "VenueMarkerType" NOT NULL,
    "level" TEXT NOT NULL DEFAULT '',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "distanceMeters" DOUBLE PRECISION,

    CONSTRAINT "VenueMarker_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueMarker_venueId_level_idx" ON "VenueMarker"("venueId", "level");

ALTER TABLE "VenueMarker" ADD CONSTRAINT "VenueMarker_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
