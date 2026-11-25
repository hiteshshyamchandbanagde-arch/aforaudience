-- BUG-2609-086 - when a venue's seat map was last saved, so the Seat Map
-- Builder can discard a local draft that the server copy supersedes.
-- Nullable, no backfill: venues not saved since stay null and only the
-- 24 h draft-age rule applies to them.
-- Applied directly against aforaudience-qa (nqiyrypmjtogoocerxtu) only -
-- see 20260906120000_add_event_follow_target's own header for why this
-- project never uses `prisma migrate dev` / `_prisma_migrations`. This
-- file documents what ran; it does not auto-run on its own.
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "seatMapSavedAt" TIMESTAMP(3);
