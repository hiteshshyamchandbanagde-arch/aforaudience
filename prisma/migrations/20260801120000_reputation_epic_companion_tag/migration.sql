-- Reputation epic (5/9) - Companion Tagging Phase 1 (checkout capture + consent)
CREATE TYPE "CompanionTagStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Booking" ADD COLUMN "companionTaggingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "companionTaggingConsentAt" TIMESTAMP(3);

CREATE TABLE "CompanionTag" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "taggedByUserId" TEXT NOT NULL,
  "taggedUserId" TEXT NOT NULL,
  "status" "CompanionTagStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "CompanionTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanionTag_bookingId_taggedUserId_key" ON "CompanionTag"("bookingId", "taggedUserId");
CREATE INDEX "CompanionTag_taggedUserId_status_idx" ON "CompanionTag"("taggedUserId", "status");

ALTER TABLE "CompanionTag" ADD CONSTRAINT "CompanionTag_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanionTag" ADD CONSTRAINT "CompanionTag_taggedByUserId_fkey" FOREIGN KEY ("taggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanionTag" ADD CONSTRAINT "CompanionTag_taggedUserId_fkey" FOREIGN KEY ("taggedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
