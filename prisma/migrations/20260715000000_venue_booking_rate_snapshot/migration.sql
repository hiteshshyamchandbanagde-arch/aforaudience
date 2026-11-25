-- F6 - Rate snapshot on confirmed VenueBookings.
--
-- Context: VenueBooking already stores agreedRateType, durationHours,
-- durationDays, and platformFeeAmount, which the schema comment says are
-- "snapshotted at confirmation time so later changes to the Venue's
-- published rates don't retroactively alter a confirmed booking". The
-- intent was already there, but the actual RATE values (hourlyRate,
-- dailyRate) were never captured on the booking - only on the Venue,
-- which is mutable. Result: a confirmed booking's rate could
-- retroactively shift if the Venue Owner edited Venue.hourlyRate later.
--
-- This migration adds the two missing snapshot columns. The confirm
-- code path (PATCH /api/venue-bookings/[id]) is updated in the same PR
-- to populate them on the PENDING -> CONFIRMED transition, alongside
-- the agreedRateType/durationHours fields that the confirm code was
-- also silently leaving null.
--
-- Both columns are nullable and additive:
--   - Existing rows keep NULL (historical bookings retain their
--     `amount` and `agreedRateType`, which is enough for legacy audit).
--   - FLEXIBLE-rate bookings will also keep NULL - there IS no
--     published rate for FLEXIBLE venues; `amount` is the negotiated
--     deal, which is already immutable on the booking.
--   - Only HOURLY / DAILY confirmations populate these going forward.
--
-- Not backfilling: current Venue rates are TODAY's values, not the
-- values at the historical confirmation time. Writing them onto old
-- rows would fabricate history worse than leaving NULL.

ALTER TABLE "VenueBooking"
  ADD COLUMN "snapshotHourlyRate" DOUBLE PRECISION,
  ADD COLUMN "snapshotDailyRate"  DOUBLE PRECISION;
