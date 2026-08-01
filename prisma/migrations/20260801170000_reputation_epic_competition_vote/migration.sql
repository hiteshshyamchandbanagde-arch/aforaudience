-- Audience Choice voting (reputation epic §6, session 58). Additive only,
-- applied live to QA Supabase via Supabase MCP before this file was
-- written (standing principle: additive migrations are safe ahead of
-- branch merge). Confirmed default weighting (Hitesh, session 58):
-- 80/10/10 Audience/Panelist/Celebrity.

CREATE TYPE "VoterCategory" AS ENUM ('AUDIENCE', 'PANELIST', 'CELEBRITY');

CREATE TABLE "CompetitionVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "category" "VoterCategory" NOT NULL,
  "voterId" TEXT NOT NULL,
  "performanceId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_eventId_category_voterId_rank_key" UNIQUE ("eventId", "category", "voterId", "rank");
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_eventId_category_voterId_performanceId_key" UNIQUE ("eventId", "category", "voterId", "performanceId");

ALTER TABLE "Event" ADD COLUMN "audienceVoteWeight" INTEGER;
ALTER TABLE "Event" ADD COLUMN "panelistVoteWeight" INTEGER;
ALTER TABLE "Event" ADD COLUMN "celebrityVoteWeight" INTEGER;

ALTER TABLE "PlatformSettings" ADD COLUMN "audienceVoteWeightDefault" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "PlatformSettings" ADD COLUMN "panelistVoteWeightDefault" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "PlatformSettings" ADD COLUMN "celebrityVoteWeightDefault" INTEGER NOT NULL DEFAULT 10;
