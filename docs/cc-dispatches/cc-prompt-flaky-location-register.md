# CC dispatch: two unstable nightly tests (14 Nov red run 43591452734, same commit 2d1c238 green on 12, 13 and 15 Nov)

> **Branch off `origin/qa`: `fix/flaky-location-register`.** Small chunks, commit + push after each. 45-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row. No masking, no `maxDiffPixels`, no retries/timeouts raised, no skip/fixme. **First decide whether each one is a product race or a test race**, and fix the real cause.

## 1. `e2e/use-my-location.spec.ts:161` [GEN-2610-005], chromium-desktop, failed on attempt and retry
"saved Jaipur, GPS in Pune": after the person picks **Jaipur** from the list, the chip read **"Pune▾"** (expected Jaipur). Passed in the 4 nightlies before it and the one after.
- Suspect a **product race**: the GPS/auto-detect result (or the initial city fetch) resolves *after* the manual pick and overwrites it. That breaks the rule "ask, never switch on its own" (the travel prompt). Check `LocationChip` / the location provider for a late `setCity` from geolocation or the `/api/...` city detect that doesn't respect a newer manual choice. If confirmed, fix it in product code: a manual pick wins, and stale async results are dropped (request id / abort / "user picked" flag).
- Regression proof: make the late resolution deterministic in the test (delay the geolocation or city-detect response with `page.route` / a delayed `setGeolocation`), so the spec fails on `origin/qa` and passes on the branch.
- If it turns out to be a test-only race, fix the wait (`settledChipText` must really wait for detection to settle) and explain why the product is right.

## 2. `e2e/launch-waves-ui.spec.ts:214` [S1b-b1] (hi), flaky on both projects
`locator('input[name="fullName"]')` resolved to **2 elements**: a Hindi one (placeholder "आपका पूरा नाम") and an English one ("Your full name"), i.e. two register forms in the DOM at once.
- Find out whether users can see two forms. Likely suspects: the locale switch re-mounting the form with a different key while the old one is still mounted (Suspense/transition), or the holding/register states overlapping. If both forms are ever visible → product fix (one form, keyed correctly). If it's an invisible, momentary transition → the test waits for exactly one form in the target locale (`toHaveCount(1)` on the Hindi placeholder) before filling, with a comment.
- Regression proof as above where feasible.

## Tests
Run both specs, both projects, **5× each** locally (`--repeat-each=5`) on the branch and report the pass counts; also report what `origin/qa` gives with the deterministic reproduction. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: verdict per test (product vs test race, with code refs), the fix, before/after, repeat-each results, and the pushed head. Human check only if a product fix changes behaviour a person can see.
