# CC dispatch C: fixes from Hitesh's 4 Oct visual check + tests that replace his remaining manual checks

> **New branch `fix/batch-c` off `origin/qa`.** One commit per item. Push, stop. Chat merges. Runs unattended on the CC autopilot.

**FIRST ACTION:** write `cc-autopilot-status.md` (not committed): `RESULT: PARTIAL fix/batch-c none` and "started". Update after every push. **Budget about 120 turns.** Base must be the current `origin/qa` (it includes B2 if merged; if `test/retest-backlog-b2` isn't merged yet, base on qa anyway and don't touch B2's files). Read `docs/testing-rules.md`, `docs/test-coverage-map.md`. Ticket IDs in test titles in `[…]`. Every fix gets a test that fails on `origin/qa` and passes on the branch (T1). Local runs use `--grep-invert @needs-db`.

Decisions are made by chat under Hitesh's delegation (4 Oct). Don't re-ask them:
1. **[BUG-2610-008]** `src/app/(public)/artists/page.tsx` ~L288: the selected-genre underline uses `var(--afa-fill-solid)`, which should be `var(--afa-selected)`. Test: the computed colour of the selected genre's underline equals `--afa-selected`'s computed value.
2. **[GEN-2609-118] amber, not orange, for two non-action elements** (decided: orange = an action you tap, only):
   - the **"See fee breakdown →"** link on `/checkout/<id>/` → `--afa-selected`, or the amber text token used for secondary links (pick the existing token; no new literals);
   - the **big count circle** on the booking-confirmed ("You're going") screen → amber fill or amber ring, with text contrast ≥ 4.5:1.
   - Test: on each of those screens, exactly one element has the computed background or text colour equal to `--afa-fill-solid`, and it's the primary button. Use an existing QA booking for the confirmed screen if there's a read-only route to it; else mark `@needs-db` and create and cancel one through the fixture. **No real payments.**
3. **[GEN-2609-121] the two parts Hitesh hasn't seen** become tests:
   - an artist's public profile (Hrithik): each show's ticket link is the primary (orange), "+ Follow" is outline (no `--afa-fill-solid` background), and the prev/next arrows have no filled background;
   - Messages as Atul, any thread: the Send button's background is `--afa-fill-solid`.
   - Add these to the goal spec or a new `colour-rules.spec.ts`.
4. **[BUG-2610-009]** `/events/`: while events load, the "Showing N events" count is hidden (or a neutral placeholder), never "0". Extend `events-load.spec.ts` (slow response): no "0 events" text before the data arrives.
5. **[BUG-2610-003]** Ticket tier shows "–": on My Tickets for a numbered-seat booking (Jaipur Mic Gala 100, tier "General ₹250"), and the Jaipur listing card's price shows "–". Find the root cause (the seat booking probably doesn't record or resolve its tier; the card likely reads a tier list that numbered-seat events don't fill) and fix both. **Don't rewrite existing bookings' rows**; resolve the tier at read time from the seat → tier mapping where it's missing. Test: the Jaipur card shows "₹250" (or "From ₹250"), and a numbered-seat booking card shows its tier name.
6. **Seat page, no seats chosen:** the total shows "Free" with 0 seats. Show no amount (or "—") until a seat is chosen, and keep "Free" only for genuinely free events. Test it.
7. **My Tickets:** "Download ticket (PDF)" wraps to 3 lines at 390/440 px. Keep the three action buttons on one row with each label at most 2 lines (shorter label "Download PDF" is fine, i18n'd in all locales). Test: each button's height is at most 2 line-heights at 390.

**Not in this batch (decided):** keep the two bottom bars as they are; GEN-2608-041 translation quality and BUG-2608-030 (600-seat tapping on a real phone) stay HUMAN and are not blocking.

Then update `docs/test-coverage-map.md` (121 → tested; 118 → tested).

## Status file at the end
`RESULT: PUSHED fix/batch-c <sha>` (or PARTIAL), with per item: root cause in one line, the test title, and red-on-qa/green-on-branch.
