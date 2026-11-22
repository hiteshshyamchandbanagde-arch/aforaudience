# CC dispatch: make `prisma migrate deploy` work on an EMPTY database (prod launch blocker)

> **New branch `fix/prod-fresh-replay` off `origin/qa`.** Small chunks, commit + push after each. 45-min limit; if not done, push what works and list what's left in the status file. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** **Never connect to prod or QA databases** — everything here runs on a throwaway in-memory Postgres.

## Why (chat, 22 Nov)
Prod launch = wipe prod schema → `prisma migrate deploy` (84 migrations). Nobody had ever replayed all 84 on an empty DB (`migration-seed-parity.test.ts` only simulates DesignToken/PlatformSettings statements). Chat replayed them in PGlite (`@electric-sql/pglite`, `db.exec(migration.sql)` in folder order):
1. ❌ `20260802080000_feedback_workflow_overhaul`: `invalid input value for enum "FeedbackStatus": "TESTED"` — QA's enum got `TESTED` out-of-band; the `CASE status WHEN 'TESTED'` can't compile on a fresh DB. Chat's scratch fix `CASE status::text` gets past it, then:
2. ❌ same migration: `relation "CodeCounter" does not exist` — `CodeCounter` (schema.prisma) is created by **no** migration (QA out-of-band).
Expect more drift after that (QA changes applied via Supabase `apply_migration` whose .sql was committed "for the record" but not always replay-safe or complete).

## Do
1. **Committed test first** — `scripts/migration-replay.test.ts` (PGlite as devDependency): replays every `prisma/migrations/*/migration.sql` in order on an empty DB; fails with the migration name + error. Then it checks the result matches `prisma/schema.prisma`: every model's table + columns (+ enums and their values) exist. Use `prisma migrate diff` against the replayed DB if you can wire it (e.g. `@electric-sql/pglite-socket`), else a schema-introspection comparison against the Prisma DMMF. Also assert the existing seed results (DesignToken 115 = globals.css set, PlatformSettings = only `singleton`, DisplayCurrencyRate rows) — reuse the parity test's expectations. Add it to CI next to the other unit self-tests. It must FAIL on `origin/qa` (show output).
2. **Fix forward, minimal:**
   - Historical migrations that can't replay: smallest replay-safe edit (e.g. `status::text`, `CREATE TABLE IF NOT EXISTS "CodeCounter"` placed before its first use). Each edit gets a `-- 22 Nov: replay-safe for a fresh DB (prod); no-op on QA` comment.
   - Objects in schema.prisma that no migration creates: one new idempotent catch-up migration at the end (`IF NOT EXISTS` / `DO $$ … EXCEPTION` guards) so it's a **no-op on QA**.
   - Before editing historical files, check whether QA's `_prisma_migrations` records checksums for them (read `docs/`/HANDOFF notes; QA migrations are applied via Supabase `apply_migration`, not `migrate deploy`). State the finding: does editing old files cause any checksum problem anywhere?
3. Keep iterating until the replay test passes end to end and the schema check is clean. List every drift item found and how it was fixed.

## Tests
New replay test fails on qa / passes on branch; existing `migration-seed-parity.test.ts` still passes; tsc, eslint (touched files), design-tokens green.

## Finish
Status file: full drift list (migration → error → fix), the checksum finding, whether the new catch-up migration must also be applied on QA (chat applies it via `apply_migration` if so — put its exact SQL in the status), pushed head, Human check: none.
