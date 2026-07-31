-- Competition show fields (31 Jul feedback, Hitesh confirmed shape same session)
ALTER TABLE "Event"
  ADD COLUMN "isCompetitionShow" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "competitionPrizeFirst" TEXT,
  ADD COLUMN "competitionPrizeSecond" TEXT,
  ADD COLUMN "competitionPrizeThird" TEXT,
  ADD COLUMN "celebrityAttendingName" TEXT,
  ADD COLUMN "celebrityPhotoUrl" TEXT;

CREATE TABLE "EventPanelist" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bio" TEXT,
  "photoUrl" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventPanelist_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventPanelist" ADD CONSTRAINT "EventPanelist_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EventPanelist_eventId_idx" ON "EventPanelist"("eventId");
