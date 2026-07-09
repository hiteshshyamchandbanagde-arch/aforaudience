ALTER TABLE "VenueBookingRequest" ADD COLUMN "eventId" TEXT;

ALTER TABLE "VenueBookingRequest" ADD CONSTRAINT "VenueBookingRequest_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
