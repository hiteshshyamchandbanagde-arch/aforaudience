-- Tour by Organiser (12 Aug, "as a collaborator" session). Organiser-owned
-- series of real bookable Events, distinct from the pre-existing
-- ArtistTourStop (self-reported, informational, FEAT-2608-047).

CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PENDING_CONSENT', 'LIVE', 'CANCELLED', 'COMPLETED');
CREATE TYPE "EventCategory" AS ENUM ('STANDALONE', 'TOUR_STOP');

CREATE TABLE "Tour" (
  "id" TEXT NOT NULL,
  "organiserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT,
  "slug" TEXT NOT NULL,
  "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");
CREATE INDEX "Tour_organiserId_idx" ON "Tour"("organiserId");

ALTER TABLE "Tour" ADD CONSTRAINT "Tour_organiserId_fkey"
  FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One consent record per artist per Tour (not per stop) - reuses the
-- existing InviteStatus enum (same shape as EventPanelist/Celebrity
-- Accept-to-Appear).
CREATE TABLE "TourArtistConsent" (
  "id" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "artistId" TEXT NOT NULL,
  "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TourArtistConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TourArtistConsent_tourId_artistId_key" ON "TourArtistConsent"("tourId", "artistId");
CREATE INDEX "TourArtistConsent_artistId_idx" ON "TourArtistConsent"("artistId");

ALTER TABLE "TourArtistConsent" ADD CONSTRAINT "TourArtistConsent_tourId_fkey"
  FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourArtistConsent" ADD CONSTRAINT "TourArtistConsent_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event additions. category defaults STANDALONE so every existing row is
-- valid with no backfill. openSlotCount/slotDuration/applicationDeadline
-- are nullable, only meaningful when category = TOUR_STOP.
ALTER TABLE "Event" ADD COLUMN "category" "EventCategory" NOT NULL DEFAULT 'STANDALONE';
ALTER TABLE "Event" ADD COLUMN "tourId" TEXT;
ALTER TABLE "Event" ADD COLUMN "openSlotCount" INTEGER;
ALTER TABLE "Event" ADD COLUMN "slotDuration" INTEGER;
ALTER TABLE "Event" ADD COLUMN "applicationDeadline" TIMESTAMP(3);

CREATE INDEX "Event_tourId_idx" ON "Event"("tourId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_tourId_fkey"
  FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
