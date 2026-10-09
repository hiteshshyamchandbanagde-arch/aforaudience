# CC dispatch 6a-amend: finish dashboard i18n part 1 (GEN-2610-007)

> **Existing branch `feat/dashboard-i18n-6a`** (head `f7e31e1`: shared chrome + Artist translated, unit tests). FIRST rebase onto `origin/qa`. Never merge, never merge-commit. Push after EVERY commit. Chat merges. Autopilot. Do not edit `.github/workflows/`. QA DB only. Read `docs/cc-dispatches/cc-prompt-dashboard-i18n-6a.md` for the full brief.
> The previous run (37914137385) ended ~14 min in with `is_error` while writing the e2e spec. Push small commits early.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/dashboard-i18n-6a none`.

1. **e2e-preview on `f7e31e1`: 4 failed, deterministic** — `e2e/colour-closeout.spec.ts:79` and `:97` (both projects). The spec finds the artist application badge with `getByText('pending'|'rejected', { exact: true })`; 6a now renders the translated label (English text changed from the raw status). The product change is intended; fix the TEST to locate the badge by a stable hook (e.g. a `data-afa-status` attribute on the pill, added in the product) rather than by its text, so it keeps working in every locale. Keep the colour/contrast assertions exactly as they are. Justify in the status file (change to an existing spec).
2. **Finish the 6a e2e spec** per the 6a brief: Artist dashboard in hi at 390 and 1440 (role bottom bar, More sheet, My Applications, Browse Events) shows no English UI strings (allow-list proper nouns); spot check mr and de; English baselines unchanged; persona locale back to none.
3. Grep `e2e/` for any other spec that finds dashboard UI by English text on the Artist dashboard or shared dashboard chrome and would break under 6b/6c the same way; switch those to stable hooks now and list them.
4. Full local e2e before the last push.

Status file: `RESULT: PUSHED feat/dashboard-i18n-6a <sha>`, what changed for 1-3, namespaces + string counts, TODO i18n list, e2e-preview result, and the **Human check** (Hitesh reads Artist dashboard in Hindi and Marathi).
