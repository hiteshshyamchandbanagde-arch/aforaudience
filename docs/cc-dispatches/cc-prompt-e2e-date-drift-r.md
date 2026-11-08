# CC dispatch: run R, red nightly since 21 Oct (date drift), T3 first item

> **New branch `fix/e2e-date-drift-r` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next. **45-min hard limit, push after every commit.** Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.** Run locally only the specs you touch.

**Start:** `git fetch && git reset --hard origin/qa`. Read `HANDOFF.md` Part 63 ("FIRST: red nightly"), `docs/testing-rules.md`, `e2e/helpers/roles.ts`, `scripts/qa-seed.ts`, `scripts/qa-seed-data.ts`.

## Facts (chat, from nightly annotations)
- Every E2E (QA) nightly has been red from 21 Oct to 8 Nov (23 runs). The last green was 20 Oct. No product code has changed since 16 Oct (`qa` 3337f67), so the cause is the calendar moving, not a code change. Latest run 41302059027: 584 passed, 10 failed.
- `e2e/offline-tickets.spec.ts:148` [BUG-2610-001], 390 + 1440: `toHaveScreenshot` diff on the offline ticket card (Atul, "Mixed Bag Comedy Lineup", event 21 Dec). Suspect relative-time text ("in 2 months" / "in N weeks") inside the shot.
- `e2e/unfinished-checkout.spec.ts:54` [BUG-2610-018] @needs-db, 390 + 1440: screenshot diff on `[data-afa-unfinished-checkouts]`. Suspect "N h left" text.
- `e2e/seat-total.spec.ts:36`: `expect(free, "QA has an upcoming free event")` fails, so the seeded free event is now in the past.
- `e2e/venue-revenue.spec.ts:29` [BUG-2609-087] (red from 1 Nov, the month rollover): the Total Revenue sub-line shows "▼ 100.0% vs last period" where the spec expects "by event date · no platform cut on rentals". Find out why the month change switches that line (data or code). If it's code (for example the sub-line is replaced whenever a previous period exists), that's a real bug: fix the code, don't change the spec's expectation.
- Mobile `language-rollout.spec.ts:96` (bn, sometimes gu): known intermittent flake (lang stays "en" after 10 s).

## What to do
1. Confirm each cause before fixing it (read the failing shot and diff if the run artifacts are available locally, or reproduce with a frozen clock).
2. Time-dependent screenshots: freeze the clock in the spec (`page.clock.setFixedTime` / `page.clock.install`) at a fixed date that keeps the fixture event upcoming, so relative-time text is stable. Keep pixel shots and the same thresholds. Refresh baselines only where needed and justify each one in the status file (T2).
3. Aging data (the free event, and any spec that needs an upcoming event): the spec must stop depending on seed dates that expire. Prefer that the spec creates its own fixture rows with dates relative to now through `E2E_DATABASE_URL` and removes them afterwards (T6, QA personas only). Also fix `scripts/qa-seed-data.ts` so seeded "upcoming" events use dates relative to the seed time. **Code only: do not run the seed and do not change QA rows.**
4. venue-revenue: per the facts above, a real fix if it's code; date-relative fixture data if it's data.
5. The language-rollout flake: make the wait deterministic (wait for the `lang` attribute or the cookie or response that sets it, not a fixed timeout). No retries added and no timeout raised.
6. If one of these can't be fixed within the run: Rule 4 quarantine (`test.fixme` with a note naming the ticket) and say so in the status file. Never skip, delete or loosen.

## Tests (T1/T2)
- Each fixed spec must pass on the branch, and pass when run twice in a row. Before/after: failing on `origin/qa` today, passing on the branch.
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.

## Finish
- Status file `cc-autopilot-status.md` (T7): cause per spec, what changed, baselines refreshed and why, anything quarantined. Human check: none expected (tests only), unless a product bug was found.
- Do not touch the Feedback table. No seed run, no QA data changes.
