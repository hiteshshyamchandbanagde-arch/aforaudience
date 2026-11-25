-- GEN-2610-006 - the account's language choice, so it follows the person
-- to another device. Nullable, no backfill: accounts that never picked a
-- language stay null and keep the device's choice (default English).
-- The column already existed on aforaudience-qa (nqiyrypmjtogoocerxtu)
-- before this file; IF NOT EXISTS makes it a no-op there. See
-- 20260906120000_add_event_follow_target's own header for why this
-- project never uses `prisma migrate dev` / `_prisma_migrations`. This
-- file documents what ran; it does not auto-run on its own.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
