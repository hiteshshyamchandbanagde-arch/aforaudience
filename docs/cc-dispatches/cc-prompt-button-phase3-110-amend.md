# CC dispatch: GEN-2609-110 amendments (PR #711) — run AFTER BUG-2609-062 has merged

> **Same branch as #711: `feat/gen-2609-110-button-phase3`. Nothing else in this run.** Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch`, check out `feat/gen-2609-110-button-phase3`, **rebase onto `origin/qa`** (which will then include the local-fonts fix, so the preview can go green), then force-push with lease **before** making any change. Read `HANDOFF.md` 27 Sep parts 5-6.

## Chat review decisions (27 Sep part 6)
- **Accepted as-is:** support widget tabs becoming underlined `tab`s (6px shorter); /venues underline turning amber; venue-create rate type matching venue-edit; the Guided Setup toggle not being orange when off; the admin artists sort headers in mono.
- **Fix 1: locale-code tap targets** (SiteNav ~L618 and HomeHeader ~L238, `text-toggle`). Moving to `text-toggle` dropped their padding. Restore a hit area at least as large as before #711, and never below 24×24 CSS px (WCAG 2.5.8). Keep the visible text the same size. Do this only for these two call sites (a `size` on `text-toggle` or call-site min-width/min-height with padding, your choice). The other 5 `text-toggle` sites must not change.
- **Fix 2: seat-picker Reset** (SeatPicker ~L296). It's `outline-neutral sm` and looks dimmer than the −/+ `icon` buttons next to it. Make Reset match them: same border (`--afa-tint-20`), background (`--afa-surface-raised`), text colour (`--afa-text-primary`) and 28px height. Only the width comes from the label.
- **Check: `scrim` focus.** Open a sheet (e.g. the mobile filter sheet or SiteNav on 390), Tab onto the scrim, and confirm the amber ring, or confirm the scrim is deliberately not focusable (then say why).

## Verification
tsc; `next build`; checker vs origin/qa; ratchet at or below baseline (update only if the rebase requires it; nothing may rise); checker self-tests; ESLint per-line diff; before/after screenshots of the two locale menus (390) and the zoomed seat picker; Vercel preview green on the pushed head.

## Handoff
Compare link (same PR #711), the rebase result (conflicts, if any, and how they were resolved), commits, and the screenshots summary.
