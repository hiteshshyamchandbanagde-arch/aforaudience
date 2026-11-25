-- S1a (Hitesh, 8 Nov) - "paid bookings" master switch. Soft launch is
-- free discovery + free-event tickets only; paid flows are refused on the
-- server until an admin turns this on in /dashboard/admin/settings.
-- Default false and NOT set true here: prod's clean DB is built from these
-- files. Chat applies this to QA by hand and sets QA's row to true there
-- so existing paid e2e flows keep working. See
-- 20260906120000_add_event_follow_target's header for why this project
-- never uses `prisma migrate dev` / `_prisma_migrations`.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "paidBookingsEnabled" BOOLEAN NOT NULL DEFAULT false;
