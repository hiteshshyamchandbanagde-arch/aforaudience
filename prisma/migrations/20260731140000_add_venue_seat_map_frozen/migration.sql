-- Seat-map cluster #4 (design.md §9.4, session 48) - explicit Freeze action.
ALTER TABLE "Venue" ADD COLUMN "seatMapFrozen" BOOLEAN NOT NULL DEFAULT false;
