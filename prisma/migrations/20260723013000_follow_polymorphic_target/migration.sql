-- Migrate Follow from Artist-only to polymorphic Artist/Venue/Organiser target,
-- plus a per-follow notification mute toggle (bell icon pattern).
CREATE TYPE "FollowTargetType" AS ENUM ('ARTIST', 'VENUE', 'ORGANISER');

ALTER TABLE "Follow" ADD COLUMN "targetType" "FollowTargetType" NOT NULL DEFAULT 'ARTIST';
ALTER TABLE "Follow" ADD COLUMN "targetId" TEXT;
ALTER TABLE "Follow" ADD COLUMN "notifyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: every existing row is an Artist follow (this table was Artist-only until now).
UPDATE "Follow" SET "targetId" = "artistId" WHERE "targetId" IS NULL;

ALTER TABLE "Follow" ALTER COLUMN "targetId" SET NOT NULL;
ALTER TABLE "Follow" ALTER COLUMN "targetType" DROP DEFAULT;

ALTER TABLE "Follow" DROP CONSTRAINT "Follow_artistId_fkey";
DROP INDEX "Follow_userId_artistId_key";
ALTER TABLE "Follow" DROP COLUMN "artistId";

CREATE UNIQUE INDEX "Follow_userId_targetType_targetId_key" ON "Follow"("userId", "targetType", "targetId");
