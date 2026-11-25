# CC dispatch: holding-page "Sign in" link, 44px tap target (Part 70 Next #2)

> **Branch off `origin/qa`: `fix/holding-signin-tap-target`.** Small chunks, commit + push after each. 25-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** No DB changes. Never write the QA `PlatformSettings` row (all four waves must stay true).

## Problem
On the W1 holding page (`src/components/LaunchHoldingPage.tsx`, the `data-afa-holding-signin` `<Link href="/login">`), the Sign in link is caption-size underlined text. Its tap box is about the text's line height, well under 44px, so it is hard to hit on a phone (390). Admins use this link to get in while W1 is closed.

## Fix
- Give the link a tap box of at least 44×44px at every breakpoint: `display: inline-flex`, `alignItems: center`, `justifyContent: center`, `minHeight`/`minWidth` 44px. Use a token if one exists for tap targets (grep `globals.css` / `design-tokens.ts`). If none exists, use a literal with a `token-ok(...)` note per the checker convention. Add horizontal padding from the space tokens if needed.
- Keep the look the same: same colour, caption size, underline. Only the hit area grows. Whole-pixel box, per docs/design.md §9.0.
- Keep the overall vertical rhythm. Adjust `marginTop` if the bigger box visibly pushes the link down.

## Tests (T1)
- In `e2e/launch-waves-ui.spec.ts`, next to the existing `[data-afa-holding-signin]` check (~line 303), assert `getBoundingClientRect()` width ≥ 44 and height ≥ 44 at 390 and 1440. It must fail on `origin/qa` and pass on the branch. Report both results.
- Holding-page screenshot baselines: refresh only the ones that change, and justify each in the commit message. Don't loosen thresholds.
- Run locally: `launch-waves-ui.spec.ts` and `launch-waves-polish.spec.ts` (both projects). Run tsc, eslint (touched files) and design-tokens; all must be green.

## Finish
Status file: before/after measured box at 390 and 1440, the tests' fail→pass results, baselines touched, and the pushed head. Human check: tap Sign in on a real phone with W1 off (Hitesh's phone check 2). Don't touch the Feedback table or any DB.
