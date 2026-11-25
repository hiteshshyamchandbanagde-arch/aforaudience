-- Checkpoint 2 — Payments plumbing.
--
-- What this adds:
--   1. PaymentStatus enum — models the lifecycle of a Razorpay payment
--      through frontend verify + server-side webhook.
--   2. Payment model — one row per Razorpay order. Kept as a separate
--      table (not fields on Booking) so we can attach payments to tips,
--      subscriptions, refunds later without conflating them with tickets.
--   3. Booking.expiresAt — 15-minute TTL on PENDING bookings, so an
--      abandoned checkout doesn't permanently eat capacity.
--
-- What this deliberately leaves alone:
--   - Booking.paymentId (existing String? column) — kept for migration
--     safety; will be removed in a later cleanup once we're certain no
--     old code references it. Not read by the new payment flow.
--
-- Money is stored in PAISE (INTEGER), never rupees (FLOAT). Razorpay
-- itself uses paise, and any float representation of currency risks
-- accumulated rounding errors on totals.

-- 1. PaymentStatus enum
CREATE TYPE "PaymentStatus" AS ENUM (
    'CREATED',            -- Razorpay order created; user hasn't paid yet
    'VERIFIED',           -- Frontend signature verified; booking marked CONFIRMED
    'WEBHOOK_CONFIRMED',  -- Webhook also confirmed; safety net check passed
    'FAILED',             -- Payment failed at Razorpay
    'MISMATCH'            -- Frontend + webhook disagree; needs human review
);

-- 2. Payment table
CREATE TABLE "Payment" (
    "id"                TEXT NOT NULL,
    "bookingId"         TEXT NOT NULL,
    "razorpayOrderId"   TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount"            INTEGER NOT NULL,
    "currency"          TEXT NOT NULL DEFAULT 'INR',
    "status"            "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "verifiedAt"        TIMESTAMP(3),
    "webhookReceivedAt" TIMESTAMP(3),
    "failureReason"     TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- One Payment per Booking, at least for MVP. Retries against the same
-- booking would recycle its Payment row rather than create a second one.
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId")
    REFERENCES "Booking"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 3. Booking.expiresAt for PENDING TTL
ALTER TABLE "Booking" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Composite index so the capacity check can efficiently filter out
-- expired PENDING rows: WHERE status='PENDING' AND expiresAt > NOW()
CREATE INDEX "Booking_status_expiresAt_idx"
    ON "Booking"("status", "expiresAt");
