# CC dispatch: GEN-2610-005 "tapped before the saved city has loaded" red on qa push runs (Rule 4)

> **New branch `fix/gen-2610-005-tap-gate` off `origin/qa`.** Small chunks, commit + push after each. 40-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No migrations, no QA DB writes beyond what the spec already does. Never write the QA `PlatformSettings` row.

## Failure (chat triage, 18 Nov)
`e2e/use-my-location.spec.ts:215` `[GEN-2610-005] saved Jaipur, tapped before the saved city has loaded: still asks, never switches on its own` → `getByRole(banner|menu).getByRole('status')` `toContainText("You seem to be in Pune. Switch?")` times out at 10 s; the status stays **"Finding you…"** the whole time (12 polls). Not a wrong decision: the answer never lands.

| Run | Trigger | Head | Result |
|---|---|---|---|
| 43939714813 | push (qa) | cbc6cbe (#784) | ❌ chromium-desktop + mobile-chrome, both attempts |
| 44054574526, 44096634509 | schedule | af00556 | ✅ |
| 44031870527 a2 | e2e-preview (#785 branch, unique URL) | 048f596 | ✅ both projects, 8.3 s |
| 44097402048 | push (qa) | 4bacebd (#785) | ❌ mobile-chrome both attempts; desktop ✅ 7.7 s |

- Red **before** #785 (cbc6cbe), so #785's `getPlatformSettings()` in the session callback is not the cause.
- Passing runs take ~8 s; the spec's fixed **4 s hold** on every `GET /api/user/location` sits on top of real latency. After the tap the answer is serial: `getCurrentPosition` → `fetchCities()` **again** if the click handler's closure still has `citiesLoaded === false` (stale closure; the picker's own fetch may be in flight) → `await locationRead.current` (held 4 s + server time). On a slow/cold run that sum passes 10 s.
- Chat could not reach Vercel hosts and the runtime logs are past retention, so the latency split is a hypothesis. **Confirm or correct before changing anything.**

## Do
1. **Measure.** In this test, record request start/finish times for `/api/user/location` and `/api/cities` (and the tap time) and attach them with `test.info().attach` (permanent, cheap diagnostics). Reproduce locally against `next build && next start` with `--repeat-each=10`, both projects; also once with CPU throttling or added route latency on `/api/cities` to show the serial chain. Put the numbers in the status file.
2. **Test fix (justify in the commit; the assertion and its 10 s timeout stay unchanged):** replace the fixed 4 s hold with a **gate**: the route holds the saved-city read until the test releases it right after `useRow.click()`. That keeps the guarantee the test exists for (tap lands before the saved city is read) and removes 4 s of artificial wait from the answer's budget. This tightens the test, it doesn't loosen it.
3. **Product fix, only if step 1 shows the duplicate cities fetch in the chain:** in `src/components/LocationChip.tsx` keep the pending cities fetch in a ref (like `locationRead`) and have `handleUseMyLocation` reuse it instead of calling `fetchCities()` a second time; start it and the saved-city wait in parallel (`Promise.all`). Add a unit/self-test or e2e check that one tap makes at most one `/api/cities` request.
4. Don't add `test.fixme`, retries, `maxDiffPixels` or longer timeouts. If it is still red twice after 2–3 → **then** quarantine with `test.fixme` + say so in the status file (chat files the Feedback ticket).

## Tests
`use-my-location.spec.ts` both projects `--repeat-each=10` green; any spec you touch; tsc, eslint (touched files), design-tokens green. Regression evidence: show the gated test failing on `origin/qa`'s LocationChip only if you changed product code (step 3); otherwise report before/after timings.

## Finish
Status file: measured timings (before/after), root cause confirmed or corrected, what changed in the test and why, product change (if any), pushed head, Human check: none expected.
