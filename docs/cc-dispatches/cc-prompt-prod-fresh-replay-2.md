# CC dispatch: fresh-replay part 2 — copy QA's code triggers exactly + RLS on every table (security)

> **Continue on the existing branch `fix/prod-fresh-replay`** (head f058cf2). Check it out from origin, rebase onto origin/qa if needed (never merge), add commits on top. Small chunks, commit + push after each. 30-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never connect to prod or QA databases.

## Chat review of part 1 (read-only QA introspection, 22 Nov)
Part 1 is good (85/85 replay, schema match). Two gaps vs QA:

1. **Role codes.** QA does NOT use column defaults. It has `generate_role_code(p_prefix)` (same body as your reconstruction) **plus 4 trigger functions and BEFORE INSERT triggers**, each `if new."code" is null then new."code" := generate_role_code('<P>'); end if; return new;`:
   - `set_user_code()` / `trg_user_code` on "User" ('AFA')
   - `set_artist_code()` / `trg_artist_code` on "Artist" ('ART')
   - `set_organiser_code()` / `trg_organiser_code` on "Organiser" ('ORG')
   - `set_venueowner_code()` / `trg_venueowner_code` on "VenueOwner" ('VEN')
   QA `code` columns have **no default**. → In `20261122120000_fresh_db_catchup`, replace the `SET DEFAULT` lines with these functions + triggers (create only if missing: `pg_proc` / `pg_trigger` checks), so a fresh DB equals QA. Add `SET search_path = public` to all 5 functions (Supabase advisor `function_search_path_mutable` flags all 5 on QA) via `ALTER FUNCTION … SET search_path = public` — safe to run on QA too.
2. **RLS (security, ERROR level).** Supabase advisor on QA: 24 public tables have RLS **disabled** (Account, PushSubscription, CorporateBookingInquiry, DesignToken, DisplayCurrencyRate, …) and are readable through the REST API with the public anon key. 28 have RLS enabled with no policies (deny-all). Migrations only enable RLS on ~5 tables, so a fresh prod would expose almost everything incl. "User". The app never uses supabase-js (only Prisma as owner → bypasses RLS), so deny-all is safe.
   → New migration `20261122130000_enable_rls_all_public_tables`:
   ```sql
   DO $$ DECLARE t record; BEGIN
     FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
     END LOOP;
   END $$;
   ```
   (Exact SQL — chat applies the same on QA.) Also add to `docs/testing-rules.md` or AGENTS.md one line: every new table's migration must `ENABLE ROW LEVEL SECURITY`.

## Tests
Extend `scripts/migration-replay.test.ts`: after replay, (a) every public table has `relrowsecurity = true`, (b) the 4 triggers exist and inserting a "User" with no code yields `AFA<YYMM>000001`, then a second yields `…000002`, (c) all 5 functions have `search_path=public` in `proconfig`. Must fail on f058cf2 / pass after. Existing parity + replay tests green; tsc, eslint, design-tokens green.

## Finish
Status file: before/after for the new assertions, the exact SQL chat must apply on QA (RLS migration + ALTER FUNCTION lines), pushed head, Human check: none.
