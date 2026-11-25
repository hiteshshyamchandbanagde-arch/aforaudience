-- Checkpoint 4 — audience booking fee.
--
-- What this adds:
--   1. Booking.subtotalAmount + Booking.bookingFeeAmount (Float, rupees).
--   2. New audienceBookingFee (Int, paise) + updatedAt columns on the
--      pre-existing PlatformSettings table.
--
-- Why PlatformSettings already exists: an earlier design iteration
-- (pre-fifth-amendment) added it with fields for commission rates and a
-- flat venue booking fee. The fifth amendment retired those fields as
-- dead columns — safe to leave, never read. See master design doc §4.5
-- for the reasoning. This migration extends the same table with a new
-- LIVE field (audienceBookingFee) rather than creating a second config
-- table, keeping the "one home for platform-wide config" invariant.
--
-- Booking fields: default 0 so existing rows aren't broken; backfilled
-- immediately so historical paid bookings have subtotal = total, which
-- is true — they had no fee.
--
-- audienceBookingFee stored in PAISE (integer, consistent with
-- Payment.amount). A value of 0 means "no fee" — the checkout page,
-- PDF, and email all skip fee display and behave exactly like
-- Checkpoint 3 did. Admin flips this to a real number from
-- /dashboard/admin/settings.

ALTER TABLE "Booking"
  ADD COLUMN "subtotalAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bookingFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Booking" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" = 0;

ALTER TABLE "PlatformSettings"
  ADD COLUMN "audienceBookingFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "PlatformSettings" ("id", "audienceBookingFee", "updatedAt")
VALUES ('singleton', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
