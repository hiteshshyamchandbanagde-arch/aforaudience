-- Admin artist roster (session 56). Additive only, applied live to QA
-- Supabase via Supabase MCP before this file was written (standing
-- principle: additive migrations are safe ahead of branch merge).

ALTER TABLE "Artist" ADD COLUMN "headlinerNote" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "artistRosterHypeScoreLookback" INTEGER NOT NULL DEFAULT 5;
