-- GEN-2609-042 - Step 6's onboarding welcome sequence. Adds the field
-- that gates whether the new full-screen takeover shows on next login
-- (onboardedAt) and the field that drives its final screen's
-- role-appropriate CTA (intendedRole).
--
-- NOT YET APPLIED to aforaudience-qa as of this file being written -
-- unlike every other migration in this directory, this one hit the
-- Claude Code auto-mode classifier's "Cloud Storage Mass Delete" guard
-- (a false positive - this is an additive ALTER + a backfill UPDATE,
-- nothing is deleted) and needs explicit approval before running via
-- Supabase:apply_migration. Once approved, applies directly against QA
-- exactly like every other migration here (see
-- 20260906120000_add_event_follow_target's own header for why this
-- project never uses `prisma migrate dev` / `_prisma_migrations`) -
-- this file documents what ran (or, right now, what's queued to run),
-- it does not auto-run on its own.
--
-- Backfill preview shown before running (233 rows in aforaudience-qa as
-- of 13 Sep 2026, 232 already isVerified - only 1 real unverified row):
--   id                                    | role     | isVerified | createdAt
--   4c7833ea-7cef-4153-b27f-f84e4021d33f  | ADMIN    | true       | 2026-07-11 16:42:37
--   qa-audience-001                       | AUDIENCE | true       | 2026-09-10 01:44:45
--   qa-audience-002                       | AUDIENCE | true       | 2026-09-10 01:44:45
--   qa-audience-006                       | AUDIENCE | true       | 2026-09-10 01:44:45
--   qa-audience-007                       | AUDIENCE | true       | 2026-09-10 01:44:45
-- Backfilled to each row's own createdAt, not now() - see the reasoning
-- on the `onboardedAt` field in schema.prisma (avoids falsely clustering
-- all 233 pre-existing users into one instant on any future
-- cohort/analytics query against this column).

ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "intendedRole" TEXT;

UPDATE "User" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
