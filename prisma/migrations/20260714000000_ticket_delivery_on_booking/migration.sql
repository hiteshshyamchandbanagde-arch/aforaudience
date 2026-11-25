-- Move ticket-delivery tracking from Payment → Booking.
--
-- Why: free events have no Payment row (there's nothing to pay for), so
-- the atomic claim in deliverTicket() — which ran on Payment.updateMany
-- WHERE deliveredAt IS NULL — always affected 0 rows and short-circuited,
-- meaning free events never received their PDF/email. Root cause of the
-- known gap tracked in Master Design Doc §9.2 and EPIC M.
--
-- Booking is the common entity for both paid and free flows, so the claim
-- moves there. Payment.deliveredAt / Payment.deliveryError stay in the
-- schema for now (deprecated, do-not-read from application code) so
-- historical rows keep their audit trail. Safe to drop in a future
-- cleanup migration once all app code is confirmed off them.
--
-- Backfill: for existing rows where Payment.deliveredAt is set, copy the
-- same timestamp onto Booking.deliveredAt (same for deliveryError). This
-- prevents any future admin-retry pathway from re-firing delivery for
-- bookings that already got their email.

ALTER TABLE "Booking"
  ADD COLUMN "deliveredAt"   TIMESTAMP(3),
  ADD COLUMN "deliveryError" TEXT;

-- Backfill from Payment for paid events that already delivered.
UPDATE "Booking" b
SET
  "deliveredAt"   = p."deliveredAt",
  "deliveryError" = p."deliveryError"
FROM "Payment" p
WHERE p."bookingId" = b.id
  AND p."deliveredAt" IS NOT NULL;
