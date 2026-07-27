-- PR #212: Venue.placeId - stable Google Place ID from Address autocomplete,
-- additive/nullable, mirrors lat/lng lifecycle. Applied to QA via
-- Supabase:apply_migration MCP; this file is documentation only (does not
-- propagate to prod).
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "placeId" TEXT;
