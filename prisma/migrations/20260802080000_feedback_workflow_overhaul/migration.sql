-- Feedback workflow overhaul (session 63, Hitesh's design).
-- Already applied directly to QA Supabase via Supabase:apply_migration -
-- this file is documentation of what ran, per standing practice
-- (migrations via apply_migration first, matching .sql committed after
-- for the record; does not auto-run from this file).

-- 1. New FeedbackStatus enum (old: NEW, REVIEWED, TESTED, RESOLVED)
CREATE TYPE "FeedbackStatus_new" AS ENUM (
  'NEW','UNDER_REVIEW','BUILD_QUEUE','IN_BUILD','BUILD_COMPLETE',
  'IN_TEST','RESOLVED','REJECTED','REOPENED'
);

ALTER TABLE "Feedback" ADD COLUMN "status_new" "FeedbackStatus_new";

UPDATE "Feedback" SET "status_new" = CASE status
  WHEN 'NEW' THEN 'NEW'
  WHEN 'REVIEWED' THEN 'UNDER_REVIEW'
  WHEN 'TESTED' THEN 'IN_TEST'
  WHEN 'RESOLVED' THEN 'RESOLVED'
END::"FeedbackStatus_new";

ALTER TABLE "Feedback" DROP COLUMN "status";
ALTER TABLE "Feedback" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DEFAULT 'NEW';
ALTER TABLE "Feedback" ALTER COLUMN "status" SET NOT NULL;

DROP TYPE "FeedbackStatus";
ALTER TYPE "FeedbackStatus_new" RENAME TO "FeedbackStatus";

-- 2. New FeedbackDeployStage enum + column (nullable - only meaningful
--    once status = RESOLVED; all existing RESOLVED rows stay null, no
--    historical record of deploy stage to backfill)
CREATE TYPE "FeedbackDeployStage" AS ENUM (
  'DEPLOYED_QA','IN_PRODUCT','NOTIFIED_USER','CLOSED'
);
ALTER TABLE "Feedback" ADD COLUMN "deployStage" "FeedbackDeployStage";

-- 3. Human-readable displayId (e.g. BUG-2608-001)
ALTER TABLE "Feedback" ADD COLUMN "displayId" TEXT;

WITH numbered AS (
  SELECT id, category, to_char("createdAt", 'YYMM') AS ym,
    ROW_NUMBER() OVER (PARTITION BY category, to_char("createdAt",'YYMM') ORDER BY "createdAt") AS seq
  FROM "Feedback"
)
UPDATE "Feedback" f
SET "displayId" = (
  CASE numbered.category
    WHEN 'BUG' THEN 'BUG-'
    WHEN 'FEATURE_IDEA' THEN 'FEAT-'
    WHEN 'QUESTION' THEN 'QST-'
    WHEN 'GENERAL' THEN 'GEN-'
    WHEN 'OTHER' THEN 'OTH-'
  END || numbered.ym || '-' || LPAD(numbered.seq::text, 3, '0')
)
FROM numbered
WHERE f.id = numbered.id;

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_displayId_key" UNIQUE ("displayId");

-- 4. Seed CodeCounter so future Feedback inserts continue the sequence
--    correctly instead of restarting at 001 per prefix/month
INSERT INTO "CodeCounter" (prefix, "yearMonth", "currentSeq")
SELECT
  CASE category
    WHEN 'BUG' THEN 'BUG'
    WHEN 'FEATURE_IDEA' THEN 'FEAT'
    WHEN 'QUESTION' THEN 'QST'
    WHEN 'GENERAL' THEN 'GEN'
    WHEN 'OTHER' THEN 'OTH'
  END,
  to_char("createdAt", 'YYMM'),
  count(*)
FROM "Feedback"
GROUP BY 1, 2
ON CONFLICT (prefix, "yearMonth") DO UPDATE SET "currentSeq" = GREATEST("CodeCounter"."currentSeq", EXCLUDED."currentSeq");

-- 5. note field on FeedbackChangeLog for rejection reasons / reopen comments
ALTER TABLE "FeedbackChangeLog" ADD COLUMN "note" TEXT;
