-- FEAT-2608-045 (11 Aug) - event T&C checklist + admin-moderated special notes
CREATE TYPE "EventNoteStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Event"
  ADD COLUMN "termsChecklist" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "specialNotes" TEXT,
  ADD COLUMN "specialNotesStatus" "EventNoteStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "specialNotesRejectionReason" TEXT,
  ADD COLUMN "specialNotesReviewedAt" TIMESTAMP(3);
