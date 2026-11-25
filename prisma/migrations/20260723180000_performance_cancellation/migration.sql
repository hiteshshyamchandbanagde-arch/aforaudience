-- Artist self-cancellation for Buy-in slots, with a refund/wallet-credit
-- choice. Additive only.
CREATE TYPE "BuyInRefundStatus" AS ENUM ('REFUNDED', 'WALLET_CREDITED');

ALTER TABLE "Performance" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Performance" ADD COLUMN "buyInRefundStatus" "BuyInRefundStatus";

ALTER TABLE "Organiser" ADD COLUMN "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
