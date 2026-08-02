ALTER TABLE "PlatformSettings"
  ADD COLUMN "directPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "directPayoutsEnabledUntil" TIMESTAMP(3);
