-- Reputation epic (6/9) - Companion Tagging Phase 2 (per-attendee check-in)
ALTER TABLE "CompanionTag" ADD COLUMN "checkedInAt" TIMESTAMP(3);
ALTER TABLE "CompanionTag" ADD COLUMN "checkedInByUserId" TEXT;
