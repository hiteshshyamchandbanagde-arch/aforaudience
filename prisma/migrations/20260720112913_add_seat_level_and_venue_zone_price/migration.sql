-- Seat.level: real venue levels (Ground Floor, Balcony, etc). Empty string
-- ('') is the implicit single level - existing seats and single-level
-- venues need zero backfill, per the handoff's "invisible if never
-- expanded" framing.
ALTER TABLE "Seat" ADD COLUMN "level" TEXT NOT NULL DEFAULT '';

-- Rows can legitimately repeat across levels (Ground Floor row A vs
-- Balcony row A), so uniqueness must include level.
DROP INDEX IF EXISTS "Seat_venueId_row_number_key";
CREATE UNIQUE INDEX "Seat_venueId_level_row_number_key" ON "Seat"("venueId", "level", "row", "number");

-- Per-zone suggested price (decision: organiser-facing DEFAULT/prefill
-- only, never a lock - organiser can still override at event creation,
-- same as today's TicketTier.price model). Separate table rather than a
-- column on Seat, since a zone spans many seats and shouldn't be
-- denormalized per-seat.
CREATE TABLE "VenueZonePrice" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT '',
  "zoneName" TEXT NOT NULL,
  "suggestedPrice" DOUBLE PRECISION,
  CONSTRAINT "VenueZonePrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueZonePrice_venueId_level_zoneName_key" ON "VenueZonePrice"("venueId", "level", "zoneName");
ALTER TABLE "VenueZonePrice" ADD CONSTRAINT "VenueZonePrice_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
