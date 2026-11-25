-- SMS OTP toggle (Hitesh, 17 Nov). Prod launches without MSG91 (no DLT
-- yet), so SMS OTP is an admin setting. Additive only. Default false and
-- NOT set true here: prod's clean DB is built from these files. Chat
-- applies this to QA by hand and sets QA's row true so QA keeps testing
-- the full OTP flow on the mock provider.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "smsOtpEnabled" BOOLEAN NOT NULL DEFAULT false;
