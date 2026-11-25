-- Applied to QA via Supabase MCP (Supabase:apply_migration). This file is
-- documentation of that migration, per standing practice - it does not
-- run automatically against prod.
ALTER TABLE "Organiser"
  ADD COLUMN "razorpayAccountId" TEXT,
  ADD COLUMN "razorpayAccountStatus" TEXT;
