# User Name Realism Correction Spec

Companion to `docs/qa-seed-script-spec.md` and `docs/load-test-user-seed-spec.md`.
This is a **correction pass on already-live QA data** — an UPDATE-only migration on
`User.name`, not a fresh insert. Decided with Hitesh, session 62 (1 Aug), chat only —
hand this spec to Claude Code (local repo) to build. Do not use Copilot for any part
of this (standing rule, session 60/61).

## Trigger

Hitesh flagged (session 62) that user-facing names read as test-pattern strings, not
real names. Confirmed via direct DB query before scoping: this affects both the
original `qa-seed.ts` batch (`qa_artist_001` style) and the newer load-test batch
(`Audi00000001` style) — not just the batch built this session.

## Scope — exactly which rows

**In scope (5,820 rows), matched by regex against current `User.name`:**
| Pattern | Batch | Roles | Count |
|---|---|---|---|
| `^qa_[a-z]+_[0-9]+$` | base `qa-seed.ts` | Artist(100), Audience(100), Organiser(10), Venue Owner(10) | 220 |
| `^(Audi\|Organiser\|Venue\|Artist)[0-9]{8}$` | load-test batch | Artist(300), Audience(5000), Organiser(200), Venue Owner(100) | 5600 |

**Out of scope, do not touch:** ~101 rows that don't match either pattern — e2e
fixture accounts (`e2e.fixture.organiser@example.com` etc.), named test personas
(Nikita, Dimple/Dimpal), the Admin user, and any other already-realistic name. Only
rows matching the two regexes above are candidates for update.

**Only the `User.name` column changes.** Email, phone, password hash, id, role, and
every relation stay exactly as-is — this decouples display name from login
credentials, per Hitesh's explicit call this session, so existing e2e specs and any
test scripting that reference email/phone patterns keep working unmodified.

## Name generation

- **Audience, Organiser, Venue Owner:** real human first-name + last-name
  combinations, majority Indian names (matches the platform's India-first audience),
  drawn from reasonably large first-name and last-name pools (not a short fixed
  list) so combinatorial variety keeps exact duplicates rare across ~5,300 rows in
  these three roles combined. Occasional duplicate full names are fine/expected at
  this volume (real cities have namesakes too) — not something to engineer around.
- **Artist (400 rows): combination, per Hitesh's explicit call.** Deterministic split
  by artist index — roughly half get a real human name (same pool as above; fits
  artists like stand-up comics, poets, theatre performers who typically perform under
  their real name), the other half get a stage/performer-style name (e.g. "DJ Neon",
  "The Firestorm Collective", "Midnight Radio") drawn from a separate curated pool
  built to sound plausible across genres (music, comedy, spoken word, drag/variety) —
  avoid generic single-word names that would look thin next to the real ones.
- No change to `Artist.bio` — already populated (0 empty), out of scope here.

## Idempotency

Self-idempotent by construction: the script selects rows still matching the two
old-pattern regexes above. Once a row's `name` is replaced with a real-looking name,
it no longer matches either regex, so a re-run naturally skips it — no separate
"already processed" flag needed. Safe to re-run if interrupted partway through.

## Execution

- Batch UPDATEs (e.g. 200–500 rows per statement/transaction), not 5,820 individual
  single-row updates — keep this fast and within normal query limits.
- Given ~5,820 rows across the User table (core identity data), treat this with the
  same care as the standing >20-row rule even though it's UPDATE not DELETE — show a
  row-count + a real sample (10–15 before/after name pairs across different roles)
  before running for real, get explicit go-ahead.

## Guards (carry over from existing seed scripts)

- Hard-block anything but QA project ref (`nqiyrypmjtogoocerxtu`); never prod
  (`cncumfwwnjcwacggrgsr`).
- Never touch `Feedback`/`FeedbackChangeLog`.
- No DELETE — this is UPDATE-only, and only the `name` column.
- git fetch/status/reset --hard origin/qa before running, per standing checklist.
- Route to Claude Code only, never Copilot.
- After running, verify independently against Supabase QA DB (via chat) — spot-check
  a sample of updated rows plus confirm the regex-matched row count dropped to 0 (or
  to just the out-of-scope ~101), don't trust only the script's self-reported summary.
