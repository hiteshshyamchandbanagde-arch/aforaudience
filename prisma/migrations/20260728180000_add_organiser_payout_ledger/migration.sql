-- Applied to QA via Supabase MCP (Supabase:apply_migration). This file is
-- documentation of that migration, per standing practice - it does not
-- run automatically against prod.
--
-- Manual-transfer payout ledger + Organiser compliance fields, added
-- after confirming Razorpay Route is unavailable on this account (RBI
-- 2025 PA Directions restrict split-settlement to merchants above a
-- turnover threshold this business doesn't clear yet). See design doc
-- §4.5 correction. Nothing writes to these yet - schema exists ahead
-- of the feature so real payout rows never have to be migrated later.

CREATE TYPE "OrganiserEntityType" AS ENUM ('UNKNOWN', 'INDIVIDUAL', 'HUF', 'COMPANY', 'LLP', 'PARTNERSHIP', 'OTHER');

CREATE TYPE "OrganiserPayoutStatus" AS ENUM ('OWED', 'PAID');

ALTER TABLE "Organiser"
  ADD COLUMN "entityType" "OrganiserEntityType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "panNumber" TEXT,
  ADD COLUMN "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gstin" TEXT;

CREATE TABLE "OrganiserPayoutLedger" (
  "id" TEXT NOT NULL,
  "organiserId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "amountOwed" DOUBLE PRECISION NOT NULL,
  "financialYear" TEXT NOT NULL,
  "status" "OrganiserPayoutStatus" NOT NULL DEFAULT 'OWED',
  "paidAt" TIMESTAMP(3),
  "payoutReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganiserPayoutLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganiserPayoutLedger_bookingId_key" ON "OrganiserPayoutLedger"("bookingId");

CREATE INDEX "OrganiserPayoutLedger_organiserId_financialYear_idx" ON "OrganiserPayoutLedger"("organiserId", "financialYear");

CREATE INDEX "OrganiserPayoutLedger_status_idx" ON "OrganiserPayoutLedger"("status");

ALTER TABLE "OrganiserPayoutLedger"
  ADD CONSTRAINT "OrganiserPayoutLedger_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganiserPayoutLedger"
  ADD CONSTRAINT "OrganiserPayoutLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
