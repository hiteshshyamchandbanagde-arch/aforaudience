-- Seat-map cluster #5 (design.md §9.4, session 49) - PDF/image reference
-- underlay, per level.

CREATE TABLE "VenueLevelUnderlay" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.4,

    CONSTRAINT "VenueLevelUnderlay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueLevelUnderlay_venueId_level_key" ON "VenueLevelUnderlay"("venueId", "level");

ALTER TABLE "VenueLevelUnderlay" ADD CONSTRAINT "VenueLevelUnderlay_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
