-- D3 (Hitesh, 8 Nov) - Organiser <-> Artist performance fees with DIRECT payment.
-- PAID: the organiser pays the artist; BUY_IN: the artist pays the organiser.
-- AFA never collects. Reuses D2's BookingPaymentMethod.DIRECT and the
-- DirectPayStatus enum (created by 20261109120000_add_venue_direct_pay).
-- Additive only: every new column is nullable or has a default, so every
-- existing row stays valid and unchanged (paymentMethod NONE, directPayStatus NULL).
-- Chat applies this to QA by hand (this project never uses `prisma migrate dev`).

ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "upiQrUrl" TEXT;

ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "upiQrUrl" TEXT;

ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "paymentMethod" "BookingPaymentMethod" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "directPayStatus" "DirectPayStatus";
ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "paidMarkedAt" TIMESTAMP(3);
ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "payerReference" TEXT;
ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Performance" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Performance_directPayStatus_expiresAt_idx" ON "Performance" ("directPayStatus", "expiresAt");
