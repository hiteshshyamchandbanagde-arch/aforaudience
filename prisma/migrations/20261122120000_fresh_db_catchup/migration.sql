-- 22 Nov: fresh-DB catch-up (prod launch). Creates the schema.prisma
-- objects that QA got out-of-band and no earlier migration creates, so
-- `prisma migrate deploy` on an EMPTY database ends up matching
-- schema.prisma. Every statement is guarded (IF NOT EXISTS / pg_catalog
-- checks): a no-op on QA, which already has all of this.
-- Found by scripts/migration-replay.test.ts.

-- 1. Role codes: User/Artist/Organiser/VenueOwner.code (String? @unique)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "VenueOwner" ADD COLUMN IF NOT EXISTS "code" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_code_key" ON "User"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Artist_code_key" ON "Artist"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Organiser_code_key" ON "Organiser"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "VenueOwner_code_key" ON "VenueOwner"("code");

-- 2. EmailVerificationToken
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Otp (phone OTP for signup verification and OTP login)
CREATE TABLE IF NOT EXISTS "Otp" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Otp_phone_idx" ON "Otp"("phone");

-- 4. CodeCounter (also created replay-safe in 20260802080000; repeated
--    here so the catch-up stands alone)
CREATE TABLE IF NOT EXISTS "CodeCounter" (
  "prefix" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "currentSeq" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CodeCounter_pkey" PRIMARY KEY ("prefix", "yearMonth")
);

-- 5. generate_role_code(): QA fills the codes above with a DB function
--    (AFA/ART/ORG/VEN + YYMM + 6-digit per-month sequence from
--    CodeCounter, e.g. ORG2608000058 - see src/lib/auth-helpers.ts
--    CODE_PATTERN). Its QA definition is not in the repo. Reconstructed
--    here and wired as column defaults ONLY when no generate_role_code
--    exists at all, so QA's own version is never touched.
DO $outer$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_role_code') THEN
    EXECUTE $fn$
      CREATE FUNCTION generate_role_code(p_prefix TEXT) RETURNS TEXT
      LANGUAGE plpgsql VOLATILE AS $body$
      DECLARE
        ym TEXT := to_char(now(), 'YYMM');
        seq INTEGER;
      BEGIN
        INSERT INTO "CodeCounter" ("prefix", "yearMonth", "currentSeq")
        VALUES (p_prefix, ym, 1)
        ON CONFLICT ("prefix", "yearMonth")
        DO UPDATE SET "currentSeq" = "CodeCounter"."currentSeq" + 1
        RETURNING "currentSeq" INTO seq;
        RETURN p_prefix || ym || lpad(seq::text, 6, '0');
      END
      $body$
    $fn$;
    ALTER TABLE "User" ALTER COLUMN "code" SET DEFAULT generate_role_code('AFA');
    ALTER TABLE "Artist" ALTER COLUMN "code" SET DEFAULT generate_role_code('ART');
    ALTER TABLE "Organiser" ALTER COLUMN "code" SET DEFAULT generate_role_code('ORG');
    ALTER TABLE "VenueOwner" ALTER COLUMN "code" SET DEFAULT generate_role_code('VEN');
  END IF;
END $outer$;
