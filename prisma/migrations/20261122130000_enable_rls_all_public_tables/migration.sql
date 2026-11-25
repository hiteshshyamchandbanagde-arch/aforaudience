-- 22 Nov (security): Supabase advisor on QA flagged 24 public tables with
-- RLS disabled, readable through the REST API with the public anon key.
-- The app only talks to the DB through Prisma as the owner role (bypasses
-- RLS) and never uses supabase-js, so RLS with no policies (deny-all for
-- anon/authenticated) is safe. Enables RLS on every public table; a no-op
-- on tables that already have it. Every new table's migration must also
-- ENABLE ROW LEVEL SECURITY (AGENTS.md).
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
