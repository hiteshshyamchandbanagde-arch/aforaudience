-- S1b-a (Hitesh, 9 Nov) - launch wave switches W1-W4 on PlatformSettings.
-- Go-live is staged: prod default all OFF, admin turns them on one at a
-- time in /dashboard/admin/settings. Additive only. Default false and NOT
-- set true here: prod's clean DB is built from these files. Chat applies
-- this to QA by hand and sets QA's row all-true so QA behaves as today.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waveDiscoveryOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waveOnboardingOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waveTicketsOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "waveDirectBookingsOpen" BOOLEAN NOT NULL DEFAULT false;
