# CC dispatch B2: the last 7 untested tickets from the retest backlog

> **New branch `test/retest-backlog-b2` off `origin/qa`.** Small commits. Push, stop. Chat merges. Runs unattended on the CC autopilot.

**FIRST ACTION:** write `cc-autopilot-status.md` (repo root, not committed): `RESULT: PARTIAL test/retest-backlog-b2 none` and "started". Update it after every push. **Budget: about 120 turns.**

**Start:** `git fetch && git reset --hard origin/qa`. Base must be `db4183a` or later. Read `docs/testing-rules.md`, `docs/test-coverage-map.md` (from B1; its "untested" rows describe each test), `e2e/README.md`, `e2e/helpers/*`. Follow B1's conventions exactly: the ticket ID in square brackets in the title; QA personas only; no `src/` change unless a test exposes a real bug (then `test.fixme` + say so in the status file).

**Local runs use `--grep-invert @needs-db`** (the autopilot is outside the shared CI queue). A test that needs DB writes or the temp admin is tagged `@needs-db` and is proven by the CI preview run, not locally. Say which in the status file.

## Tests (priority order)
1. **[GEN-2609-114]** (closes the central-control goal): modal backdrops use `--afa-scrim` (computed background of the open filter sheet's and the More sheet's backdrop equals the token's value); sage text on the dark surface uses the `-bright` variant with contrast ≥ 4.5:1 (find where the ticket says sage text appears).
2. **[GEN-2609-115]** `@needs-db`: a design-token **restore** (as the per-run temp admin, through the Design System UI's restore/revert control) runs the contrast check and reports its result, and the token ends as it started; plus submit-button text contrast ≥ 4.5:1 on `/login/` and `/register/`.
3. **[GEN-2609-113]**: gold and error tone text on their tint backgrounds ≥ 4.5:1 wherever they render on QA pages (badges, alerts); pick 4-6 representative places.
4. **[GEN-2609-007]**: as Atul, save an event (heart), it appears on `/saved/`, then unsave it. Restore the starting state in `finally`.
5. **[GEN-2609-008]**: Profile hub at 390 as Atul lists the Create and Money & account rows, and the fee row opens the fee sheet (which traps focus, reusing the 065 helper).
6. **[GEN-2609-006]**: My Tickets as a persona with bookings: each card's QR encodes its bookingId (decode the QR image or read its data attribute, whichever is real), and each status keeps its actions. If no persona has bookings, create one through the normal checkout of a free/zero-price fixture **only if one exists**; else mark `HUMAN — needs a booking fixture` and say so.
7. **[FEAT-2608-047]**: as Hrithik, add a tour stop in a different country, save, and see it highlighted on his public profile; remove it in `finally` (his profile must end exactly as it started).

Then update `docs/test-coverage-map.md`: move each row to tested, tested + HUMAN or HUMAN, and recount.

## Verify
New tests twice locally (except `@needs-db`); the full suite once with `--grep-invert @needs-db`; tsc; checker and ratchet unchanged; unit self-tests.

## Status file at the end (overwrite)
`RESULT: PUSHED test/retest-backlog-b2 <sha>` (or PARTIAL), then the tests added (ID → title), which are `@needs-db`, the final coverage-map counts, and any real bugs found.
