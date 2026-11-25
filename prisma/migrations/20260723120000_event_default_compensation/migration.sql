-- Default artist compensation terms declared at event creation, so an
-- Artist can see payment terms before applying rather than after approval.
ALTER TABLE "Event" ADD COLUMN "defaultCompensationType" "CompensationType" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Event" ADD COLUMN "defaultFeeAmount" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "defaultBuyInAmount" DOUBLE PRECISION;
