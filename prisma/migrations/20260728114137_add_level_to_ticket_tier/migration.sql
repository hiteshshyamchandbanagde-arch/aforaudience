-- Applied to QA via Supabase MCP (Supabase:apply_migration), per standing
-- practice - this file is documentation only, not the source of truth.
ALTER TABLE "TicketTier" ADD COLUMN "level" TEXT NOT NULL DEFAULT '';
