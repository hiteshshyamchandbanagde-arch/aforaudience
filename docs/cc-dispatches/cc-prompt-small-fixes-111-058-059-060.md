# CC dispatch: small fixes bundle (GEN-2609-111, BUG-2609-058, BUG-2609-059, BUG-2609-060)

> **One branch covers all four tickets. Do NOT stack it on another branch, and do NOT start another ticket in this run.** Push, hand off the compare link, and stop. Chat merges.

**Start:** `git fetch && git reset --hard origin/qa`, then read `HANDOFF.md` (the 25 Sep part 2 entry).
**Branch:** `fix/gen-2609-111-small-fixes-bundle`, off `origin/qa`. Make one commit per ticket, in the order below.

## 1. GEN-2609-111: `next dev` is broken by Tailwind scanning the markdown docs

- **Symptom:** `next dev` fails to compile `globals.css`.
- **Cause:** Tailwind v4 automatic source detection picks up literal `text-[var(...)]` strings in `HANDOFF.md`, `docs/design.md` and other markdown files, and emits invalid CSS for them. `next build` is unaffected.
- **Fix:** in `src/app/globals.css`, right after `@import "tailwindcss";`, exclude the non-source trees with `@source not` directives:
  - all root `*.md` files, including `HANDOFF.md`, `CC_HANDOFF.md`, `AGENTS.md`, `CLAUDE.md` and `README.md`
  - `docs/`
  - `ddoc/`
  - `e2e/`
  - `scripts/`

  Check the exact Tailwind v4 syntax against the installed version. **Do not exclude `src/`.**
- **Verify:**
  - `next dev` compiles and `/`, `/events` and `/login` render.
  - `next build` still passes.
  - Diff the generated CSS before and after (class count / size). It must shrink or stay the same, never lose a class used in `src/`. Spot-check 5 arbitrary-value classes that live in `src/`.

## 2. BUG-2609-058: "Save as Draft" border is almost invisible on `venue/create`

- **Where:** `src/app/dashboard/venue/create/page.tsx`, around line 550. The button is `<Button variant="outline" … style={{ padding: 'var(--afa-space-3) 26px', opacity: saving ? 0.6 : 1 }}>`.
- **Fix:**
  - Change it to `variant="outline-neutral" size="md"`.
  - Drop the padding and opacity overrides; Button already handles disabled opacity.
  - Do the same for the sibling "Publish Venue" button (`variant` solid, same overrides).
- **Grep the repo for other `variant="outline"` uses on dark surfaces.** If `outline` itself is effectively invisible site-wide, report it; don't change the variant in this run.

## 3. BUG-2609-059: design-system Revert applies instantly with no confirmation (Medium)

- **Where:** `src/app/dashboard/admin/design-system/page.tsx`. The history row button (around line 428) calls `handleRevert(v.id)` directly. Hitesh changed site-wide body text with one accidental click on 25 Sep.
- **Relabel the button:**
  - `Revert (N)` becomes **`Restore this version (N)`**.
  - `Already current` stays as it is.
- **Route the click through the existing `ConfirmDialog`**, the same pattern as Reset:
  - Title: "Restore this version?"
  - Body: lists every token that will change, as `token: current → will become`, computed from the current values and the version snapshot. Show at most 10 rows, then "+N more".
  - Confirm button: "Yes, restore".
- `ConfirmDialog` currently takes `body: string`. Extend it to accept a `ReactNode`, and keep the existing callers working.
- **Tests:** if there's a unit or e2e pattern for this page, add a test proving that a click opens the dialog and Cancel changes nothing. Otherwise, run a manual Playwright check against a local build. The admin login is Google-only, so if you can't reach the page, list the exact click-through for Hitesh.

## 4. BUG-2609-060: priced bookings mislabelled "No payment (free event)" on admin bookings

- **Where:** `src/app/dashboard/admin/bookings/page.tsx`, around lines 243–251. It renders "No payment (free event)" whenever `b.payment` is null, whatever the total.
- **Fix:**

  | Condition | Label |
  |---|---|
  | `totalAmount === 0` | "Free event" |
  | `totalAmount > 0` and no payment | "No payment record", in the warning tone (use an existing warning token; don't add a new colour) |
  | payment exists | unchanged |

- Check whether any other admin or organiser page uses the same `payment ? … : 'free event'` shortcut, and fix those in the same commit.

## Verification (all required, report each)

- `tsc --noEmit`
- `check-design-tokens.js` against `origin/qa`: nothing rises; `bare-button` and `raw-button` don't grow
- both test suites
- eslint line-level diff
- `next build`
- `next dev` now compiles (this is the point of item 1)
- `login-code-case.spec.ts`

## Handoff

Delta-only. For each ticket, give what changed and file:line. Also cover:
- the CSS size before and after for item 1;
- any other `outline` or free-event sites you found;
- the click-through for Hitesh on item 3.

In the Feedback table, move all four tickets to `BUILD_COMPLETE`.
