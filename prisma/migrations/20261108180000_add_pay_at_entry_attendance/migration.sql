-- D1 (Hitesh, 8 Nov) - "Pay at entry" + attendance tracking.
-- Soft launch moves no money through AFA: for a priced show the audience
-- reserves on AFA and pays the organiser at the venue (cash/UPI).
-- Additive only. Enum types are created idempotently (DO ... EXCEPTION),
-- columns use ADD COLUMN IF NOT EXISTS with a DEFAULT. Existing events are
-- backfilled from isFree/ticketPrice/ticketTiers: free -> FREE,
-- priced -> ONLINE (so every existing paid event behaves exactly as today).
-- Chat applies this to QA by hand; see 20260906120000_add_event_follow_target
-- for why this project never uses `prisma migrate dev`.

DO $$ BEGIN
  CREATE TYPE "EventPaymentMode" AS ENUM ('FREE', 'PAY_AT_ENTRY', 'ONLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('RESERVED', 'ATTENDED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingPaymentMethod" AS ENUM ('ONLINE', 'AT_ENTRY', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "paymentMode" "EventPaymentMode" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "attendance" "AttendanceStatus" NOT NULL DEFAULT 'RESERVED';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentMethod" "BookingPaymentMethod" NOT NULL DEFAULT 'NONE';

-- Backfill: priced events (flat price or any priced tier) -> ONLINE.
UPDATE "Event" e SET "paymentMode" = 'ONLINE'
WHERE e."paymentMode" = 'FREE'
  AND e."isFree" = false
  AND (
    COALESCE(e."ticketPrice", 0) > 0
    OR EXISTS (SELECT 1 FROM "TicketTier" t WHERE t."eventId" = e."id" AND t."price" > 0)
  );

-- Backfill: existing paid bookings were paid online.
UPDATE "Booking" SET "paymentMethod" = 'ONLINE'
WHERE "paymentMethod" = 'NONE' AND "totalAmount" > 0;

-- Backfill: bookings already scanned at the door count as attended.
UPDATE "Booking" SET "attendance" = 'ATTENDED'
WHERE "attendance" = 'RESERVED' AND "checkedInAt" IS NOT NULL;
