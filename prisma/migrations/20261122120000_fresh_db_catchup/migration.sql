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

-- 5. Role codes are filled exactly as on QA (read-only introspection,
--    22 Nov): generate_role_code(p_prefix) (AFA/ART/ORG/VEN + YYMM +
--    6-digit per-month sequence from CodeCounter, e.g. ORG2608000058 - see
--    src/lib/auth-helpers.ts CODE_PATTERN) called by a BEFORE INSERT
--    trigger per table. The code columns have NO default. Each function
--    and trigger is created only if missing, so QA's own are never touched.
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
  END IF;
END $outer$;

DO $outer$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('User', 'set_user_code', 'trg_user_code', 'AFA'),
    ('Artist', 'set_artist_code', 'trg_artist_code', 'ART'),
    ('Organiser', 'set_organiser_code', 'trg_organiser_code', 'ORG'),
    ('VenueOwner', 'set_venueowner_code', 'trg_venueowner_code', 'VEN')
  ) AS v(tbl, fn, trg, prefix) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = r.fn) THEN
      EXECUTE format(
        'CREATE FUNCTION %I() RETURNS trigger LANGUAGE plpgsql AS $body$ '
        'begin if new."code" is null then new."code" := generate_role_code(%L); end if; return new; end $body$',
        r.fn, r.prefix);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = r.trg AND tgrelid = format('public.%I', r.tbl)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION %I()', r.trg, r.tbl, r.fn);
    END IF;
  END LOOP;
END $outer$;

-- Supabase advisor function_search_path_mutable flags all 5 on QA.
-- Safe to run on QA too.
ALTER FUNCTION generate_role_code(TEXT) SET search_path = public;
ALTER FUNCTION set_user_code() SET search_path = public;
ALTER FUNCTION set_artist_code() SET search_path = public;
ALTER FUNCTION set_organiser_code() SET search_path = public;
ALTER FUNCTION set_venueowner_code() SET search_path = public;
