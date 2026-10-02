# CC dispatch: BUG-2609-081 (+ reopened BUG-2609-068) — the support chat bubble never covers a tappable control on mobile

> **New branch `fix/bubble-081` off `origin/qa`.** One commit per rule (4) + one for the marked rows. Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (≥ the commit carrying this file). **If your base is older, stop: stale checkout.** Read `HANDOFF.md` parts 26-28, `docs/design.md` "Decisions 29 Sep" (BUG-2609-081 bullet + the 1 Oct confirmation), and both Feedback messages in full (QA DB, BUG-2609-081 and BUG-2609-068).

**Decision (Hitesh, final, 29 Sep + 1 Oct):** keep the floating bubble on mobile on every page. No dock into the tab bar, no hiding on /login, /register or /profile, no "Need help?" link swap. Fix overlap with the four rules below. Desktop (≥ 1024px) must not change.

## What exists (read before coding)
- `src/components/mobile/useActionRowClearance.ts`:
  - It lifts the closed bubble above rows marked `data-afa-action-row` that overlap its resting spot (measured via the hidden probe).
  - It hides the bubble if lifting would put it above `MIN_TOP` (72px).
- `src/components/SupportWidget.tsx`:
  - L140 calls the hook with `panel === 'closed' && !excluded`. **That is why the open bubble (X) sat on "Save & Unpublish"** in Hitesh's 29 Sep click-through.
  - The panel's bottom is a fixed calc off the resting spot (L114, L452-456).
- 13 marked rows today. Toast.tsx also reads the attribute and must keep working.
- `globals.css` ~L622: `body.afa-mobile-tab-bar-active` reserves only the tab bar (64px + safe area), not the bubble.

## Rule 1: mark every bottom action row
Audit every page reachable on mobile, and mark the row or the lone primary button. At minimum:
- venue edit (verify the existing mark actually covers Save Changes / Save & Unpublish / Cancel, and find out why it failed at 412px);
- venue create;
- seat page `/events/[id]/seats` Reserve row, including the Razorpay note line;
- organiser event detail buttons;
- organiser dashboard card actions where they're the last thing in view;
- My Venues card Edit.

List every page you checked and whether it needed a mark.

## Rule 2: keep lifting while the panel is open
- Call the hook regardless of `panel` (still off when `excluded`).
- While open, the panel anchors above the **lifted** button, not the resting spot. Derive the panel bottom from the same clearance value (lifted bottom + button size + the existing 12px gap) and recompute its max-height from that.
- If the button is `hidden` while the panel is open, keep it visible (the user needs X). Instead clamp the panel and button to `MIN_TOP` and let the row sit under the panel: the open panel is modal-ish and the user closes it to act. State in the handoff exactly what you chose.

## Rule 3: every page reserves bottom clearance
- On mobile, while the bubble renders (not `excluded`, config loaded), the page's last content must be able to scroll fully clear of the resting bubble.
- **One global mechanism, no per-page padding:**
  - e.g. SupportWidget toggles a body class (`afa-support-bubble-active`).
  - `globals.css` extends the existing tab-bar rule to `padding-bottom: calc(64px + env(safe-area-inset-bottom) + 56px + 8px + 12px)`, or whatever the resting geometry in `chromeOffsets.ts` actually is.
  - Derive it from the `chromeOffsets` constants; don't hand-type numbers that can drift.
- Pages that pin their own bottom bars or are excluded must not double up. Check checkout and the seat-map builder.

## Rule 4: short pages lift above any interactive element at rest
- When the document can't scroll vertically (`scrollHeight <= innerHeight + 1`), treat **every visible interactive element** under the resting spot as an action row for the lift calculation:
  - `a[href]`, `button`, `input`, `select`, `textarea`, `[role=button]`, `[tabindex]:not([tabindex="-1"])`, `label[for]`.
  - Example: /register's password show/hide at 390.
- On scrollable pages, keep today's behaviour (marked rows only), so the bubble doesn't jump while ordinary controls scroll past. Rule 3 guarantees those can always be scrolled clear.
- Re-evaluate on resize and content mutation, since short pages become long when an error message appears.

## Verify (Playwright, mobile viewports 360 / 390 / 412 / 427 / 440, plus 1280 desktop unchanged)
For each check below, give a **before-on-`origin/qa`** result and an **after** result. Report overlap numerically: the intersection area between the bubble's rect and any interactive element's rect must be 0.
- **(a)** Venue edit: scroll to the bottom; closed and **open** panel; Save & Unpublish and Cancel uncovered.
- **(b)** /register and /login at 390: password show/hide uncovered at rest.
- **(c)** Seat page Reserve plus the Razorpay note line.
- **(d)** Organiser dashboard last card's Edit; My Venues second card's Edit. Scrolled to the bottom on each, nothing is under the resting bubble.
- **(e)** /profile settings-row arrows at the bottom of the page.
- **(f)** Toasts still clear the bubble (Toast.tsx).
- **(g)** Desktop 1280 pixel diff on the same pages: zero change.
- **(h)** No visible jitter. Scroll a long page (/events): the bubble stays put except near marked rows.
- QA personas are in `e2e/helpers/roles.ts`, password `QaPass!2026`.

## Verification
- tsc; `next build`; checker vs `origin/qa`; ratchet at or below baseline, with no new literals (use `chromeOffsets` constants and tokens).
- All self-tests; ESLint per-line diff on touched files; e2e smoke.

## Handoff (delta-only)
- Compare link and commits.
- Pages audited for rule 1.
- The rule 2 choice when the button would hide.
- The rule 3 clearance value and where it's derived from.
- The (a)-(h) before/after table.
