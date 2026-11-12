CREATE TYPE "DirectRefundStatus" AS ENUM ('DUE', 'AS_AGREED', 'RECEIVED');
CREATE TYPE "DirectPayParty" AS ENUM ('ORGANISER', 'VENUE_OWNER', 'ARTIST');
ALTER TABLE "VenueBooking"
  ADD COLUMN "directRefundStatus" "DirectRefundStatus",
  ADD COLUMN "cancelledBy" "DirectPayParty",
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "refundReceivedAt" TIMESTAMP(3);
