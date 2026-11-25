-- Checkpoint 3 — ticket delivery tracking.
--
-- Two nullable columns on Payment. Both start null and are only set
-- once, at delivery time. No index needed — we only query them per
-- booking (i.e. by primary key on the parent Booking), never in bulk.
--
-- Booking status is deliberately not affected by delivery — a failed
-- ticket send does NOT rollback a CONFIRMED booking. User paid; they
-- own the seat. Retry is a separate admin flow.

ALTER TABLE "Payment"
  ADD COLUMN "deliveredAt"   TIMESTAMP(3),
  ADD COLUMN "deliveryError" TEXT;
