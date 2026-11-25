# CC dispatch 3a-amend: make fix/uiux-bundle-3a green and finish BUG-2610-020

> **Existing branch `fix/uiux-bundle-3a`** (head `72617af`: GEN-2610-006, BUG-2610-021, BUG-2610-019). FIRST rebase onto `origin/qa` (docs-only commits since). Never merge, never merge-commit. **Push after EVERY commit, immediately.** Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only.
> **Hard time limit: finish and push within 45 minutes of starting.** The run's GitHub token expires 60 minutes after the run starts (it did at 17:03 on 8 Oct and lost two commits; same on 7 Oct). Do the items in order; if time is short, stop after a pushed item and say what's left.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/uiux-bundle-3a none`.

e2e-preview on `72617af` (run 37811895700): 273 passed, **2 failed, deterministic** (failed on retry, same on `9a23e35`): `e2e/location-chip-accounts.spec.ts:56` both projects.

1. **Test bug, l.73:** `await expect(page).toHaveURL(/:\d+\/$/)` expects a port, which only exists on localhost. On the Vercel preview sign-out lands on `https://<preview>/` (the call log shows exactly that), so the wait never matches and nothing after it ever ran in CI. Fix the assertion to check the path is `/` regardless of host/port (e.g. `new URL(page.url()).pathname === "/"` via `expect.poll`, or a regex anchored on `^https?://[^/]+/$`). Grep `e2e/` for any other `:\d+` URL assumptions and fix them the same way. This is a change to the committed test from this bundle's own commit: say so in the status file. Then confirm the REST of the spec (guest chip, Hrithik's chip shows his account city) actually passes against the preview; if it does not, that is a product bug in BUG-2610-021 — fix the product, not the test.
2. **Rebuild BUG-2610-020** (the 8 Oct run built it as 504bc73 but the push failed and the runner is gone). Follow the ticket's DECISION exactly (QA Feedback table, full text): hide the count eyebrow at zero ("0 EVENTS HAPPENING NEAR YOU"); empty-state copy per the ticket, no "Try adjusting your filters" when no filter is applied; artist Browse empty state ("No published events yet. Check back soon!") and its "(IN)" city label. All 12 locales. Mumbai on QA has a venue and no events: use it. Tests at 390 and 1440 with baselines.
3. **Watch, don't touch:** `use-my-location.spec.ts:118` desktop screenshot `use-my-location-far-1440.png` failed with a 756 px (1%) diff on `6fbcaa0` only and passed on the two later commits. Do not regenerate the baseline. If it fails on your head too, find out why (compare actual vs baseline) and report with evidence.
4. Full local e2e on the rebased branch before the last push.

Status file: `RESULT: PUSHED fix/uiux-bundle-3a <sha>`, cause + fix for 1 (before/after), what 020 changed + its tests, any TODO i18n strings, the result of 3, the e2e-preview result if it finishes, and the **Human check** list for all four bundle-3a tickets.
