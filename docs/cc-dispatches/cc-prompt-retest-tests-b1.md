# CC dispatch B1: turn the retest backlog into tests (batch 1 of the 38 waiting tickets)

> **New branch `test/retest-backlog-b1` off `origin/qa`.** Small commits. Push, stop. Chat merges. **Never `git stash pop` on a clean tree.** Runs unattended on the CC autopilot.

**FIRST ACTION, before anything else:** write `cc-autopilot-status.md` (repo root, not committed) with `RESULT: PARTIAL test/retest-backlog-b1 none` and "started". **Update it after every push.** The last run ran out of turns before writing it, so keep it current the whole time.

**Start:** `git fetch && git reset --hard origin/qa`. Base must be `e56cb50` or later. Read `docs/testing-rules.md` (in full force), `e2e/README.md`, `e2e/helpers/*`. QA only, personas only, no schema change, no `src/` change unless a test exposes a real bug: then `test.fixme` + note it in the status file (chat logs the ticket). **Budget: aim to finish within ~150 turns.** Stop at the cap below even if more remain.

## Why
Testing Rule T5: a ticket closes when **its** test passes on the nightly. That needs a machine-readable link from ticket to test. Today 38 tickets sit in `BUILD_COMPLETE`/`IN_TEST`, most waiting on Hitesh.

## 1. Convention (do this first)
Every spec that verifies a ticket puts the ticket ID in its title in square brackets, e.g. `test("[BUG-2609-077] /events never shows a false empty state", …)`. One test can carry several IDs. Retitle the existing #722/#725 specs that already verify tickets: 065, 071, 078, 082 (if covered), 083, 084, 087, BUG-2610-004, 006, 007, and the goal spec (GEN-2609-119, plus 114/118/121 **only** where it actually asserts that ticket's rule). **Retitling only, no assertion changes.** The CI summary step (`e2e/ci-summary.mjs`) must also emit one annotation line listing the ticket IDs whose tests all passed, e.g. `TICKETS PASSED: BUG-2609-077, …`, and one listing those with any failure.

## 2. Coverage map
Create `docs/test-coverage-map.md`: one row per ticket below, giving the ticket, its spec and test title, or **`HUMAN`** with a one-line reason (look and feel, real device, payments, translation quality) or **`OBSOLETE`** with a reason (superseded or merged). Ticket list (status from the QA Feedback table, 3 Oct):

BUILD_COMPLETE: BUG-2609-055, 065, 068, 071, 077, 078, 081, 082, 083, 084, 087; BUG-2610-004, 006, 007; FEAT-2608-047; GEN-2609-114, 118, 119, 121.
IN_TEST: BUG-2608-030, 049, 050; BUG-2609-020, 050; FEAT-2608-044, 051; GEN-2608-041; GEN-2609-003, 004, 006, 007, 008, 010, 012, 013, 017, 113, 115.

Read each ticket's message from the Feedback table (`E2E_DATABASE_URL`, read-only `SELECT` by `"displayId"`) to know what it claims was fixed. For the three with no title (BUG-2608-030, BUG-2608-050, GEN-2609-017), read the message; if it's empty or unclear, mark them `HUMAN — no description` rather than guessing.

## 3. New tests: at most 10 this batch, in this priority order
1. **[BUG-2609-077] (HIGH)** `/events/` at 390 and 1440: events load, and a failed or slow load never shows "No events published yet" (route-intercept a slow and a failed `/api/events` response).
2. **[BUG-2609-068] [BUG-2609-081]** The chat bubble never covers a control: on 6 key pages with bottom actions (event create, checkout/seat selection, admin settings, organiser event edit, profile edit, venue booking), check `elementFromPoint` at each primary action's centre at 390 × 844.
3. **[BUG-2609-055]** No browser-default serif: on Seat Map Builder and ~6 other pages, every visible text node's computed `font-family` resolves to the app's stacks, not a bare serif.
4. **[BUG-2609-082]** Plurals: "1 event", "2 events", "1 booking" where the copy shows counts.
5. **[GEN-2609-013]** Signed-out `/tickets/` and `/profile/` at 390 show the same unified tab bar as other guest pages.
6. **[BUG-2608-049]** `/dashboard/artist/edit` tour section at 390: no field narrower than its content (no horizontal clipping); inputs usable.
7. **[BUG-2609-050]** Event edit special-notes status badge: text-to-background contrast ≥ 4.5:1 (compute from computed colours).
8. **[GEN-2609-010]** The seat map shows a price-tier legend matching the tiers on the Jaipur Mic Gala 100 fixture.
9. **[BUG-2609-020]** The dashboard role menu renders its items in the first server response (no client-side pop-in): assert they're present in the initial HTML.
10. **[GEN-2609-012]** Discover: no carousel section renders with fewer items than the sparse-row guardrail allows.

Each new test must pass on the branch. Where the fix exists on `origin/qa`, it passes there too; that's fine, these are retests, not regression proofs.

## Verify
- **Your local runs must use `--grep-invert @needs-db`.** The autopilot is outside the shared CI queue (`e2e-qa-shared-fixtures`), and the `@needs-db` specs mutate shared QA fixtures (waitlist event, design tokens); CI runs them in the queue. New tests must not need DB writes; read-only `SELECT`s are fine.
- The full suite against QA once with `--reporter=line`, plus the new tests twice. Report the duration.
- tsc; checker and ratchet unchanged; unit self-tests.

## Status file at the end (overwrite)
`RESULT: PUSHED test/retest-backlog-b1 <sha>` (or PARTIAL), then: tests added (ID → title); the coverage-map counts (tested / HUMAN / OBSOLETE / still untested); any fixme'd real bugs; the list of tickets still untested for batch 2.
