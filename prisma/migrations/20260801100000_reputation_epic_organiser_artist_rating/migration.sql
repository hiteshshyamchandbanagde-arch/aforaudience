-- Artist Reputation epic (design doc session 52-53) - step 1 of 9
-- OrganiserArtistRating: private organiser->artist rating, never shown
-- publicly, feeds Scene Status only. Retire dead Artist.hypScore
-- (profile-level, never written, stuck at 0 in prod) as part of the
-- same schema pass.

CREATE TABLE "OrganiserArtistRating" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "performanceId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganiserArtistRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganiserArtistRating_organiserId_performanceId_key" ON "OrganiserArtistRating"("organiserId", "performanceId");

ALTER TABLE "OrganiserArtistRating" ADD CONSTRAINT "OrganiserArtistRating_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganiserArtistRating" ADD CONSTRAINT "OrganiserArtistRating_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganiserArtistRating" ADD CONSTRAINT "OrganiserArtistRating_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Artist" DROP COLUMN "hypScore";
