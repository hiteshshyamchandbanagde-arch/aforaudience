# AFA Testing Rule (standing, added 3 Oct 2026)

**This rule applies to every change, every dispatch, every merge. Chat and CC both follow it. It is not re-decided per ticket.** Set by Hitesh, 3 Oct 2026. Canonical copy here; a short form is in `docs/design.md` §9.0 (rule 6).

The goal: Hitesh never has to retest something a machine can check. Every fix leaves a permanent test behind, and nothing merges unless the tests pass.

## T1. Every change leaves a permanent test
- **Bug fix:** a regression test that **fails on `origin/qa` and passes on the branch**. The handoff shows both results. If it can't be made to fail on `origin/qa` (e.g. the bug doesn't reproduce), say so; that is evidence, not a skip.
- **Logic** (money, dates, billing, permissions, status changes): unit self-tests with edge cases, added to CI.
- **UI change:** a Playwright check at 390 and 1440 for what changed, plus a screenshot baseline for each touched page.
- **CC's verification checks are never throwaway.** Every live Playwright check a dispatch runs is committed under `e2e/` as a permanent spec. "Verified live" without a committed test does not count.

## T2. Nothing merges on red
- Required before chat merges, all on the **pinned head SHA**: unit self-tests, the e2e suite against that head's Vercel preview, checker/ratchet, `tsc`, `next build`.
- No `test.only` / `test.skip` / `describe.skip` committed. No assertion loosened, timeout raised or test deleted to make a run pass: any change to an existing test states why in the handoff, and chat reviews it.
- A test that fails **2+ times** in CI is not auto-retried further: it is either a real bug (fix it) or flaky (quarantine it with `test.fixme` **and** a Feedback ticket, in the same PR). Never silently removed.

## T3. Tests run automatically
- Unit self-tests: every push.
- e2e: every PR, against its Vercel preview.
- Full e2e + screenshots + accessibility (axe) on key pages: **nightly against QA**, and the workflow must live where GitHub actually schedules it (the default branch).
- **A red nightly is the first item of the next session**, before any new work.

## T4. What goes to a human, and only this
Hitesh retests only what a machine can't judge: look and feel, real phones, real payments, translation quality, a brand-new feature's first use, and screenshot differences the tests flag for review. Every handoff lists its **"Human check"** items explicitly; anything not on that list is closed by the tests.

## T5. Ticket status follows the tests
- `BUILD_COMPLETE` → `RESOLVED` happens when the ticket's regression test passes on QA's nightly run **and** it has no Human check item open.
- A ticket with a Human check item stays open until Hitesh confirms it.

## T6. Safe test data
- QA only, QA personas (`e2e/helpers/roles.ts`). Never production (the freeze stands).
- Tests that write data clean up after themselves. Tests never change a persona's saved state (city, profile, roles) without restoring it.
- No real payments, no real emails/SMS to real people, no passwords typed into a live browser by chat.

## T7. Every handoff reports testing
Tests added (file and name, one line each on what they cover); before/after results for each regression test; CI run link and result on the pushed head; any quarantined test with its ticket; the Human check list.

## Transition (until the suite is repaired)
The e2e suite is broken today (1 green run ever, every run since mid-Sep cancelled, nightly never scheduled). **Repairing it is the next dispatch.** Until it lands, chat merges on unit CI + CC's committed specs and their reported results, and T2's e2e gate is waived **only** for that reason. From the repair dispatch onward, T1-T7 apply in full.
