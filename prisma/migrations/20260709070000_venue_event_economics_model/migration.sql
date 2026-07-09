-- §4.5 Venue & Event Economics Model — additive only. No existing column
-- is dropped, renamed, or has its type changed, so every route and page
-- that reads the old flat fields (Event.ticketPrice, VenueBooking.amount)
-- keeps working exactly as before. New structures sit alongside them
-- until the UI is migrated to use them.

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'DAILY', 'FLEXIBLE');
CREATE TYPE "CompensationType" AS ENUM ('PAID', 'FREE', 'BUY_IN');
CREATE TYPE "ApprovalMode" AS ENUM ('MANUAL', 'AUTO');
CREATE TYPE "VenueBookingRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');
CREATE TYPE "OfferProposedBy" AS ENUM ('ORGANISER', 'VENUE_OWNER');

-- AlterTable: Venue rental rate config
ALTER TABLE "Venue" ADD COLUMN "rateType" "RateType";
ALTER TABLE "Venue" ADD COLUMN "hourlyRate" DOUBLE PRECISION;
ALTER TABLE "Venue" ADD COLUMN "dailyRate" DOUBLE PRECISION;
ALTER TABLE "Venue" ADD COLUMN "minDurationHours" INTEGER;

-- AlterTable: VenueBooking - agreed terms snapshotted at confirmation
ALTER TABLE "VenueBooking" ADD COLUMN "agreedRateType" "RateType";
ALTER TABLE "VenueBooking" ADD COLUMN "durationHours" INTEGER;
ALTER TABLE "VenueBooking" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "VenueBooking" ADD COLUMN "platformFeeAmount" DOUBLE PRECISION;

-- AlterTable: Event - performer caps, approval mode, per-booking seat cap
ALTER TABLE "Event" ADD COLUMN "maxPerformers" INTEGER;
ALTER TABLE "Event" ADD COLUMN "applicationApprovalMode" "ApprovalMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Event" ADD COLUMN "maxSeatsPerBooking" INTEGER NOT NULL DEFAULT 4;

-- AlterTable: Performance - three-way compensation, defaults to FREE so
-- existing rows need no backfill
ALTER TABLE "Performance" ADD COLUMN "compensationType" "CompensationType" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Performance" ADD COLUMN "feeAmount" DOUBLE PRECISION;
ALTER TABLE "Performance" ADD COLUMN "buyInAmount" DOUBLE PRECISION;

-- CreateTable: TicketTier (per-section pricing, Organiser-editable per event)
CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalSeats" INTEGER NOT NULL,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: VenueBookingRequest (Flexible-rate negotiation)
CREATE TABLE "VenueBookingRequest" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "status" "VenueBookingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueBookingRequest_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "VenueBookingRequest" ADD CONSTRAINT "VenueBookingRequest_organiserId_fkey"
    FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueBookingRequest" ADD CONSTRAINT "VenueBookingRequest_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: VenueBookingOffer (one row per round of the counter-offer loop)
CREATE TABLE "VenueBookingOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposedBy" "OfferProposedBy" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueBookingOffer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "VenueBookingOffer" ADD CONSTRAINT "VenueBookingOffer_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "VenueBookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PlatformSettings (singleton, Admin-managed later)
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "flatVenueBookingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "performerSlotCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.08,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the one settings row so the app always has a value to read,
-- rather than every caller needing to handle "table is empty".
INSERT INTO "PlatformSettings" ("id", "flatVenueBookingFee", "ticketCommissionRate", "performerSlotCommissionRate")
VALUES ('default', 199, 0.08, 0.08);
