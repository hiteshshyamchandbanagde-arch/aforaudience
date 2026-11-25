-- Display-only currency preference (Option A, session 47, 30 Jul)
ALTER TABLE "User" ADD COLUMN "displayCurrency" TEXT;

CREATE TABLE "DisplayCurrencyRate" (
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "rateFromINR" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DisplayCurrencyRate_pkey" PRIMARY KEY ("code")
);

-- Seed common currencies. Rates are approximate starting points, admin-
-- editable from /dashboard/admin/settings - not a live feed.
INSERT INTO "DisplayCurrencyRate" ("code", "label", "symbol", "rateFromINR", "updatedAt") VALUES
  ('INR', 'Indian Rupee', '₹', 1.0, now()),
  ('USD', 'US Dollar', '$', 0.012, now()),
  ('EUR', 'Euro', '€', 0.011, now()),
  ('GBP', 'British Pound', '£', 0.0095, now()),
  ('AED', 'UAE Dirham', 'AED ', 0.044, now());
