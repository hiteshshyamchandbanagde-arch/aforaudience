-- FEAT-2608-047 (11 Aug) - self-managed artist tour stops (informational,
-- not tied to a booking flow - shows outside AFA)
CREATE TABLE "ArtistTourStop" (
  "id" TEXT NOT NULL,
  "artistId" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "date" TIMESTAMP(3),
  "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArtistTourStop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArtistTourStop_artistId_idx" ON "ArtistTourStop"("artistId");

ALTER TABLE "ArtistTourStop" ADD CONSTRAINT "ArtistTourStop_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
