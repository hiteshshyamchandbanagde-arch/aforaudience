# QA Seed Script — Spec for Claude Code

**Status:** approved direction, not yet built. Hand this file to Claude Code (VS Code extension or CLI) as the implementation brief — it is self-contained and does not need chat history/context to execute.

## Purpose
A single command that wipes QA to a known-clean baseline and reseeds a
"feels real" dataset, so Hitesh can refresh QA on demand — after every
epic, after any major schema change, or on a standing Friday 8:30am cadence
— without burning Claude chat tokens each time.

## Hard constraints
- **QA project only: `nqiyrypmjtogoocerxtu`.** The script must refuse to run
  against any other `DATABASE_URL` / project id — hardcode a check at the
  top that aborts if the connected project id doesn't match, since a
  wipe-and-reseed pointed at prod would be catastrophic. Prod is
  `cncumfwwnjcwacggrgsr` and is under a standing freeze regardless.
- **Destructive-delete confirmation still applies to the *first* run.**
  Before the script is run for the first time against real QA data, show
  Hitesh row-count samples per table (names/emails/titles, 5–10 rows) and
  get explicit go-ahead — same rule as any other bulk delete. After that,
  it's an approved recurring operation and doesn't need re-confirmation
  each run, unless the script's shape changes materially.
- **e2e fixture must survive every reseed.** The Playwright suite depends
  on `e2e.fixture.organiser@example.com` / `E2eFixture!2026`
  (org id `e2efixtureorg0001org`) and other `e2e_*` prefixed accounts
  referenced in existing specs. These must be part of the seed set itself,
  not an afterthought — check `e2e.fixture.spec.ts` / any spec referencing
  fixed IDs before finalizing the seed shape, so IDs match what specs
  expect.

## Volume (v1 — "feels real", not load-test scale)
- 1 Admin (keep existing, do not recreate)
- 100 Audience
- 10 Organiser
- 10 Venue Owner
- 100 Artist
- A handful of Events/Venues/Bookings/Reviews layered on top so the
  reputation epic (Scene Status, Hype Score, Companion Tagging,
  Panelist/Celebrity, Audience Choice) has real data to render against
  without extra manual seeding each time — reuse the Session 59 seed
  pattern (past Competition Show, lineup, 5+ reviews on one artist) as
  the template, but parameterize it.

This is explicitly **not** the load-test dataset (thousands of
venues/events) from the earlier backlog item — that's a separate,
later exercise once real-scale performance testing is scoped.

## Implementation shape
- `scripts/qa-seed.ts`, run via `npx tsx scripts/qa-seed.ts` (or add an
  npm script `db:seed:qa`). Prisma-based, not raw SQL, so it stays in
  sync with schema changes automatically.
- Two phases, both idempotent:
  1. **Wipe** — delete in FK-safe dependency order (children before
     parents), truncate or `deleteMany` per model, preserving `User`
     rows where `role='ADMIN'`.
  2. **Seed** — Faker-generated names/emails for volume accounts, plus
     the fixed-ID fixture accounts and one hand-built "golden" Competition
     Show scenario (past event, full lineup, checked-in booking, accepted
     panelist + celebrity, 5+ reviews on one artist, 5 organiser Featured
     vouches, one admin-granted Headliner) so a fresh QA reset always has
     something ready to click-test immediately, not just empty volume.
- Print a summary at the end: row counts per table, and the fixture
  credentials to log in with.
- Safe to interrupt/rerun: wrap in a transaction where possible, or make
  seed inserts use fixed deterministic IDs with `upsert` so a partial
  failure doesn't corrupt state on retry.

## Not in scope for v1
- Scheduling/cron automation (Hitesh runs it manually for now)
- Load-test volume
- Any changes to prod

## Handoff note
Building this in Claude Code is deliberate: it's a self-contained,
mechanical script with no need for the project's accumulated design
history, so it doesn't need to run inside this project's chat context.
Once built, running it costs no Claude chat tokens at all.
