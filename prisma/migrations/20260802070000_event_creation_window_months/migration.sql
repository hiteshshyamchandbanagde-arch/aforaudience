-- Feedback cms9ynuxi - default window for event creation, configurable by admin.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "eventCreationWindowMonths" INTEGER NOT NULL DEFAULT 3;
