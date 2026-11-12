ALTER TABLE "Performance"
  ADD COLUMN "directRefundStatus" "DirectRefundStatus",
  ADD COLUMN "cancelledBy" "DirectPayParty",
  ADD COLUMN "refundReceivedAt" TIMESTAMP(3);
