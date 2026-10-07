# CC dispatch M: UI/UX bundle 1, covering empty states, small honesty fixes and an i18n gap (8 tickets)

> **New branch `fix/uiux-bundle-m` off `origin/qa`.** Make one commit per ticket and push after each. Chat merges. Autopilot. Budget about 150 turns. Do not edit `.github/workflows/`. A new unit test only runs in CI if it is under `e2e/`, or if it is a `scripts/*.test.ts` file (the glob step is pending GEN-2610-004). **Prefer e2e or page-level checks.**

**FIRST ACTION:** status file `RESULT: PARTIAL fix/uiux-bundle-m none`. Update it after **each** ticket, so a run that ends early still says what's done. Read `docs/testing-rules.md`, `docs/design.md` and `e2e/helpers/roles.ts`. Use the full ticket text from the QA Feedback table (`displayId`).

Each ticket gets a regression test that fails on `origin/qa` and passes on the branch (T1). UI changes need checks at 390 and 1440. Use tokens only; no new literals. New copy goes in **all 12 locale dictionaries**: English text plus a real translation, or English as a fallback marked `// TODO i18n` in the non-English files, listed in the handoff.

1. **BUG-2609-066** `/events`: with a city filter active and zero matches, the page shows "No events published yet". It should show "No events in {city}" with a **Show all cities** action. Keep the "none yet" copy only when there's no filter.
2. **BUG-2610-002** `/dashboard/artist/events`: apply the #717 `/events` pattern. Abort superseded loads, reset the error on each load, and show error plus **Retry** instead of the false empty state.
3. **BUG-2609-079** Event cards: events priced by TicketTier show "–". Show **From ₹{lowest tier price}**. Check every card that reads `Event.ticketPrice`.
4. **BUG-2609-070** `/dashboard/venue/sales` "By venue": when every value is 0, show the page's existing empty state instead of a ₹0–₹4 axis with no bars. Keep the venue table.
5. **BUG-2609-073** Flexible Requests badge: refresh it after accept, counter or decline without a page reload. Count only requests waiting on **this user's** action, per role. Omkar (Organiser + Venue Owner, with no venue request) must not see 1 on both items.
6. **BUG-2608-091** `/dashboard/venue/bookings` Past Requests: add the booking date, plus the end date if multi-day, to each row. Use the shared date formatter.
7. **BUG-2607-101** Organiser event, Artist Applications card: label the Free/Paid/Buy-in override "Compensation for this artist" and show the event's default compensation inline. Labels only; no logic change.
8. **BUG-2608-040** Venues list in Hindi: seat counts switch from "सीटें" to "seats" for cards loaded after the first batch. Route every card through the same i18n lookup. The test should scroll past the first batch in `hi`.

Stop and report rather than guess if a ticket turns out to be already fixed, or needs a product decision. Mark it so in the status file.

Status file at the end: `RESULT: PUSHED fix/uiux-bundle-m <sha>`, one line per ticket (test, before/after), the CI link, any `// TODO i18n` strings, and the **Human check** list. That is the look on a phone for items 1, 3, 4, 6 and 7, plus the Hindi read of item 8.
