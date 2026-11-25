-- Admin-configurable band around the audience booking fee.
-- minAudienceBookingFee: floor the audience can drop the fee to at checkout.
-- maxAudienceBookingFee: per-transaction ceiling, validated against by both
-- the admin-set standard fee and any audience override.
-- Both bounded at save-time by the hardcoded MAX_BOOKING_FEE_PAISE absolute
-- ceiling in src/lib/platform-settings.ts (deploy-gated).
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "minAudienceBookingFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxAudienceBookingFee" INTEGER NOT NULL DEFAULT 50000;
