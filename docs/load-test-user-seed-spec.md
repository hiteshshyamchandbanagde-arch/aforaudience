# Load-Test User Seed Spec

Companion to `docs/qa-seed-script-spec.md`. This is a **separate, additive** volume-user
generator for load/performance testing — it does NOT wipe, replace, or interact with the
existing `qa-seed.ts` output (100 audience / 10 organiser / 10 venue owner / 100 artist +
golden Competition Show scenario + e2e fixture accounts). Every fresh run of this script
must leave all existing seed data untouched and layer new rows on top.

Decided with Hitesh, session 62 (1 Aug), chat only — hand this spec to Claude Code
(local repo) to build. Do not use Copilot for any part of this (standing rule, session 60/61).

## Scope

Creates User rows (+ child Artist rows for the Artist role) across four roles, at volume,
for load/perf testing of listing pages, pagination, and concurrent-booking scenarios.
**Does not create Venues or Events** — Hitesh is seeding those separately.

## Target counts

| Role         | Count |
|--------------|-------|
| Audience     | 5000  |
| Organiser    | 200   |
| Venue Owner  | 100   |
| Artist       | 300   |

## Naming / identifier scheme

Fixed 8-digit zero-padded sequential counter per role, starting at `00000001`. This keeps
mobile numbers at exactly 10 digits regardless of how far any future re-run extends the
range, and keeps every field deterministic/greppable for later test scripting.

- `name` (User.name — there is no separate `username` field on the schema; username = full name = this value)
- `email` = `{name}@qa.aforaudience.test` (NOT gmail.com — avoids real-mail delivery risk / Resend spam-flagging at volume)
- `phone` = role prefix + the same 8-digit counter (always 10 digits total)
- `password` = shared per-role password (bcrypt-hashed once, cached — matches existing `VOLUME_PASSWORD` pattern in `qa-seed.ts`)

| Role         | Name pattern              | Email pattern                              | Phone prefix | Example phone | Password    |
|--------------|----------------------------|---------------------------------------------|--------------|----------------|-------------|
| Audience     | `Audi00000001` … `Audi00005000` | `Audi00000001@qa.aforaudience.test`         | `98`         | `9800000001`   | `Audi@123`  |
| Organiser    | `Organiser00000001` … `Organiser00000200` | `Organiser00000001@qa.aforaudience.test` | `96`      | `9600000001`   | `Organ@123` |
| Venue Owner  | `Venue00000001` … `Venue00000100` | `Venue00000001@qa.aforaudience.test`      | `97`         | `9700000001`   | `Venue@123` |
| Artist       | `Artist00000001` … `Artist00000300` | `Artist00000001@qa.aforaudience.test`   | `95`         | `9500000001`   | `Artist@123`|

Set `isVerified = true`, `isApproved = true` on all created users (skip onboarding gates for
load-test accounts, matches existing volume-seed convention).

## Artist-specific fields (User.avatar + Artist.bio)

No field may be left empty.

- **avatar**: attempt a real image download + upload to the existing Vercel Blob store
  (same code path as production artist photo upload) for each of the 300 artists by
  default — this is a small enough count to exercise the real storage layer meaningfully.
  If the run is falling behind the ~10-minute total budget (slow network / Blob
  throttling), fall back to a fast external placeholder avatar URL for the remainder of
  the batch rather than stalling — real-upload is the default, placeholder is a timing
  safety valve, not a fixed ratio.
- **bio** (Artist.bio): cycle through a small pool of ~8-10 English bio templates across
  artists. Repetition within/across batches is acceptable — no artist may have a null or
  empty bio.

## Batching / performance

- Insert in batches of 50, using the existing `mapWithConcurrency` helper pattern already
  in `qa-seed.ts` (bounded concurrency, not one-at-a-time, not unbounded Promise.all).
  Bcrypt hash each role's shared password once and reuse (cache), same as existing script.
- Target total runtime: ~10 minutes end-to-end. Row insert volume itself is trivial
  (~5600 User rows + 300 Artist rows) — the artist image upload step is the only likely
  bottleneck, hence the placeholder fallback above.
- Before inserting, check for collisions against existing data (email/phone) as a safety
  net — should be a non-issue given the disjoint `qa.aforaudience.test` domain and role
  prefixes vs. existing `qa-seed.ts` output, but cheap to verify and worth guarding since
  this script may be re-run.

## Non-negotiable guards (carry over from `qa-seed.ts` / standing rules)

- Must refuse to run against anything but the QA Supabase project ref
  (`nqiyrypmjtogoocerxtu`) — hard-block prod (`cncumfwwnjcwacggrgsr`), same pattern as
  the existing hard guard in `qa-seed.ts`.
- **Must NOT wipe or touch existing seed data** — this script is purely additive. No
  DELETE/TRUNCATE of any kind. Confirmed explicitly by Hitesh (session 62): keep old seed
  data as-is, reused on every fresh run of this new script.
- Must NOT touch `Feedback` / `FeedbackChangeLog` tables (same permanent exclusion as all
  other seed/reseed tooling).
- Must NOT create Venues or Events — Hitesh is seeding those separately.
- Before this script is run for real: git fetch/status/reset --hard origin/qa first, per
  standing Claude Code data-creation checklist. For the first real run, show a
  row-count/sample preview and get explicit go-ahead (>20-row destructive-delete rule
  doesn't technically apply since this is additive-only, but the review-before-run habit
  still applies given the volume).
- Route this build to Claude Code only, never Copilot, per standing rule (session 60/61).
