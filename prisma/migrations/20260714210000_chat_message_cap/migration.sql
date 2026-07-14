-- Admin-configurable per-session message cap for the support chatbot.
-- Default 15 — generous enough for a real multi-turn conversation,
-- low enough to bound cost against casual repeat-refreshing. Adjustable
-- from /dashboard/admin/settings without a deploy.

ALTER TABLE "PlatformSettings"
  ADD COLUMN "chatMaxMessagesPerSession" INTEGER NOT NULL DEFAULT 15;
