ALTER TABLE "Booking"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "refundAmount" DOUBLE PRECISION,
  ADD COLUMN "razorpayRefundId" TEXT;
