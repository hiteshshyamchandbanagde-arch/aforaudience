-- Scene Status tier mechanics (reputation epic §1, amended session 55).
-- Additive only, applied live to QA Supabase via Supabase MCP before this
-- file was written (standing principle: additive migrations are safe
-- ahead of branch merge on shared QA DB, per session 54 incident/rule).

ALTER TABLE "Artist" ADD COLUMN "isSceneStatusHeadliner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Performance" ADD COLUMN "isFeaturedVouch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN "sceneStatusRisingMinGigs" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "PlatformSettings" ADD COLUMN "sceneStatusRisingMinAvgRating" DOUBLE PRECISION NOT NULL DEFAULT 4.0;
ALTER TABLE "PlatformSettings" ADD COLUMN "sceneStatusRisingMinAttendees" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PlatformSettings" ADD COLUMN "sceneStatusFeaturedVouchThreshold" INTEGER NOT NULL DEFAULT 5;
