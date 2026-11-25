-- §9.4 twenty-fourth amendment: numbered seating, additive only.
-- GENERAL_ADMISSION stays the default; existing venues/bookings untouched.

CREATE TYPE "VenueSeatingMode" AS ENUM ('GENERAL_ADMISSION', 'NUMBERED');

ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "seatingMode" "VenueSeatingMode" NOT NULL DEFAULT 'GENERAL_ADMISSION';

CREATE TABLE "Seat" (
    "id"        TEXT NOT NULL,
    "venueId"   TEXT NOT NULL,
    "tierLabel" TEXT NOT NULL,
    "row"       TEXT NOT NULL,
    "number"    TEXT NOT NULL,
    "x"         DOUBLE PRECISION NOT NULL,
    "y"         DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Seat_venueId_row_number_key" ON "Seat"("venueId", "row", "number");
CREATE INDEX "Seat_venueId_tierLabel_idx" ON "Seat"("venueId", "tierLabel");

ALTER TABLE "Seat" ADD CONSTRAINT "Seat_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingSeat" (
    "id"        TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seatId"    TEXT NOT NULL,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingSeat_bookingId_seatId_key" ON "BookingSeat"("bookingId", "seatId");
CREATE INDEX "BookingSeat_seatId_idx" ON "BookingSeat"("seatId");

ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_seatId_fkey"
    FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
