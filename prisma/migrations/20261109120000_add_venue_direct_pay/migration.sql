-- D2 (Hitesh, 8 Nov) - Organiser -> Venue owner bookings with DIRECT payment.
-- The organiser pays the venue owner straight (cash/UPI); AFA never collects.
-- Additive only: enum value/type added idempotently, every new column is
-- nullable or has a default, so every existing row stays valid and keeps
-- today's behaviour (paymentMethod NONE, directPayStatus NULL).
-- Chat applies this to QA by hand (this project never uses `prisma migrate dev`).

ALTER TYPE "BookingPaymentMethod" ADD VALUE IF NOT EXISTS 'DIRECT';

DO $$ BEGIN
  CREATE TYPE "DirectPayStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID_MARKED', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VenueOwner" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "VenueOwner" ADD COLUMN IF NOT EXISTS "upiQrUrl" TEXT;

ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "paymentMethod" "BookingPaymentMethod" NOT NULL DEFAULT 'NONE';
ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "directPayStatus" "DirectPayStatus";
ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "paidMarkedAt" TIMESTAMP(3);
ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "payerReference" TEXT;
ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "VenueBooking" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "VenueBooking_directPayStatus_expiresAt_idx" ON "VenueBooking" ("directPayStatus", "expiresAt");
