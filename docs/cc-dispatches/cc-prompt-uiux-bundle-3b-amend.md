# CC dispatch 3b-amend: make fix/uiux-bundle-3b green, then GEN-2609-002

> **Existing branch `fix/uiux-bundle-3b`** (head `b8ae472`: BUG-2610-018, -022, -023). FIRST rebase onto `origin/qa`. Never merge, never merge-commit. Push after EVERY commit. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only.
> The previous run (37870643977) ended after ~13 min with `is_error` and never ran e2e itself. Run the failing specs locally against your branch EARLY so a short run still leaves useful pushed fixes.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/uiux-bundle-3b none`.

e2e-preview on `b8ae472`: 278 passed, **12 failed** (both projects unless noted), all deterministic (failed on retry). Fix each at its cause: product bug -> fix product; wrong test (it's this bundle's own new spec) -> fix the test and say why. Never loosen or delete to pass.

1. `e2e/application-closed.spec.ts:53` (Omkar badge / per-event count) — reproduce and fix.
2. `e2e/application-closed.spec.ts:103` (Hrithik My Applications) at l.123: order expected `[qa-demo-app-full-hrithik-5, e2e-bug-2610-022-open-app, ...]`, received the two swapped. Either the sort is wrong for two upcoming applications (check the tie-break and that it sorts by EVENT date, soonest first) or the spec's expected order is computed differently from the product. Decide which, with the actual event dates as evidence.
3. `e2e/artist-browse-events.spec.ts:32` (Apply to Perform fill / no past events) — reproduce and fix.
4. `e2e/artist-browse-events.spec.ts:70` at l.98: "poster right edge is page background rgb(20,20,20)" with 123 cream pixels (247,243,238) around x=1015-1075, y=1130+ — the poster still has a stray light block at its bottom-right, or the spec samples outside the poster. Find which.
5. `e2e/ticket-actions.spec.ts:26` (BUG-2610-012, an EXISTING spec) at l.91: screenshot "Expected an image 366px by 297px, received 366px by 296px". This is a regression check from an earlier bundle that went red on this branch, so BUG-2610-018's My Tickets change moved the card by 1 px. Find what changed the height. If the 1 px is a deliberate, correct result of 018, regenerate that one baseline and justify it in the status file; otherwise restore the old layout.
6. `e2e/unfinished-checkout.spec.ts:54` (BUG-2610-018) — reproduce and fix.
7. Then **GEN-2609-002** (Register page at ~1440x864, from the 3b dispatch): fit without reordering or removing fields; a normal page scroll is acceptable if it truly can't fit; NO inner scroll box. Test at 1440x864 and 390.
8. Full local e2e on the rebased branch before the last push.

Status file: `RESULT: PUSHED fix/uiux-bundle-3b <sha>`, cause + fix for each of 1-6 (product or test, with evidence), the GEN-2609-002 change and test, the e2e-preview result if it finishes, and the **Human check** list for all four 3b tickets.
