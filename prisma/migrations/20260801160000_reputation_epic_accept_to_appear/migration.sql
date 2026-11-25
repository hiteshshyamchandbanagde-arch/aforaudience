-- Panelist & Celebrity Accept-to-Appear (reputation epic §8, session 57).
-- Applied live to QA Supabase via Supabase MCP before this file was
-- written (standing principle: additive migrations are safe ahead of
-- branch merge). Includes a data backfill: one QA test event
-- ("competitive Dimpa Do") had celebrityAttendingName='Zara Khan' set -
-- backfilled into the new Celebrity table at PENDING status (no real
-- consent existed under the old scalar field, so PENDING - not ACCEPTED -
-- is the honest status; the organiser will need to actually re-invite for
-- it to reappear publicly, which is the whole point of this feature).

CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "EventPanelist" ADD COLUMN "status" "InviteStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "EventPanelist" ADD COLUMN "userId" TEXT;
ALTER TABLE "EventPanelist" ADD COLUMN "respondedAt" TIMESTAMP(3);
ALTER TABLE "EventPanelist" ADD CONSTRAINT "EventPanelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Celebrity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "photoUrl" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "userId" TEXT,
  "respondedAt" TIMESTAMP(3)
);

ALTER TABLE "Celebrity" ADD CONSTRAINT "Celebrity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Celebrity" ADD CONSTRAINT "Celebrity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Celebrity" ("id", "eventId", "name", "photoUrl", "order", "createdAt", "status", "userId")
SELECT gen_random_uuid()::text, "id", "celebrityAttendingName", "celebrityPhotoUrl", 0, now(), 'PENDING', NULL
FROM "Event"
WHERE "celebrityAttendingName" IS NOT NULL;
