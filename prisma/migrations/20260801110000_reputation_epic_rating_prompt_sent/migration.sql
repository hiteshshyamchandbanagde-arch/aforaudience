-- Reputation epic (2/9) - post-show rating prompt
ALTER TABLE "Booking" ADD COLUMN "ratingPromptSentAt" TIMESTAMP(3);
CREATE INDEX "Booking_checkedInAt_ratingPromptSentAt_idx" ON "Booking"("checkedInAt", "ratingPromptSentAt");
