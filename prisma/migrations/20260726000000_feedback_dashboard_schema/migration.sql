-- Admin Dashboard v1 schema (session 33, 26 Jul) — design.md §9.1

-- status: free-text -> real enum (only 3 values exist today, safe lock-down)
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');
ALTER TABLE "Feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Feedback" ALTER COLUMN "status" TYPE "FeedbackStatus" USING "status"::"FeedbackStatus";
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- severity: Low/Medium/High/Critical per Hitesh's decision (26 Jul)
CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
ALTER TABLE "Feedback" ADD COLUMN "severity" "FeedbackSeverity";

-- resolvedAt: needed for time-to-resolution trend metrics
ALTER TABLE "Feedback" ADD COLUMN "resolvedAt" TIMESTAMP;

-- title: short, separate from full message, for clean list/board rows.
-- Nullable + no backfill required by the migration itself; existing rows
-- get a title derived at read-time by the API if null, so the
-- guest-facing chatbot submission flow stays untouched (no manual entry
-- required there).
ALTER TABLE "Feedback" ADD COLUMN "title" TEXT;

-- Every self-serve status/severity change gets a timestamped, attributed
-- record. Raw message stays immutable - this is the audit trail that
-- makes self-serve editing safe.
CREATE TABLE "FeedbackChangeLog" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "feedbackId" TEXT NOT NULL REFERENCES "Feedback"("id") ON DELETE CASCADE,
  "changedByUserId" TEXT,
  "field" TEXT NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FeedbackChangeLog_feedbackId_idx" ON "FeedbackChangeLog"("feedbackId");

-- RLS already deny-by-default on Feedback since the tenth amendment (15
-- Jul) - Prisma bypasses via the postgres role, no policy needed for the
-- new table either, same reasoning.
ALTER TABLE "FeedbackChangeLog" ENABLE ROW LEVEL SECURITY;
