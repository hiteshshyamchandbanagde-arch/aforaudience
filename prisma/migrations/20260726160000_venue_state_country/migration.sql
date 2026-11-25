-- City/State/Country dropdown at venue registration (session 36, 26 Jul)
-- Feedback f7bd07eb, §9.5 budget approved 25 Jul session 30.
-- Both nullable, additive - no backfill for existing venues.
ALTER TABLE "Venue" ADD COLUMN "state" TEXT;
ALTER TABLE "Venue" ADD COLUMN "country" TEXT;
