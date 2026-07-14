-- Support widget: feedback + chatbot fallback.
--
-- One table serves two entry points: the manual "Report a bug /
-- suggest a feature" widget, and the support chatbot's "I don't know
-- that — want to send it to the team?" fallback. `fromChatbot`
-- distinguishes the two without needing separate tables.
--
-- `userId` is nullable — guests can submit feedback too, consistent
-- with the browse-first access model (design doc §2): no reason to
-- gate feedback behind login.

CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FEATURE_IDEA', 'QUESTION', 'GENERAL', 'OTHER');

CREATE TABLE "Feedback" (
  "id"          TEXT NOT NULL,
  "category"    "FeedbackCategory" NOT NULL,
  "message"     TEXT NOT NULL,
  "pageUrl"     TEXT,
  "userId"      TEXT,
  "fromChatbot" BOOLEAN NOT NULL DEFAULT false,
  "status"      TEXT NOT NULL DEFAULT 'NEW',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
