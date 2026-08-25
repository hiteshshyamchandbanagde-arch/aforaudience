# Session Handoff — 25 Aug 2026 (billing dashboards root-caused + venue-flow click-through fixes)

`qa` HEAD: `ff3d483` — no new commits landed on `qa` this session; two feature branches pushed and awaiting PR creation/merge (see below).

## 🔴 Next session — priority order

1. **Rotate Razorpay + Google Places credentials** — root-caused this session (see below), no longer "unconfirmed." Both are dead keys, not a network/plumbing bug. Only Hitesh can fix this (needs the actual dashboard/console access).
2. **Merge the two branches pushed this session** (see "Shipped this session" below) — `fix/bug-2608-098-099-venue-shell` and `fix/bug-2608-100-103-seatmap-polish`. No `gh` CLI on this machine (see memory), so PRs were never opened, just pushed — open + review + merge both.
3. **`dashboard/admin/settings/page.tsx` has no dark shell at all** (found 23 Aug, still not fixed — needs an actual dark-shell pass, not a token swap). Screenshot proof in PR #535's description.
4. **`src/components/Toast.tsx` appears light-themed** (found 23 Aug, still not investigated). Visibly inconsistent with the dark `ErrorBanner` shown for the same message on the same page.
5. **BUG-2608-091 / BUG-2608-090** — small, queued, not dispatched. Past Requests rows missing date/time; a stat-card subtitle sitting on the wrong card. Pick up whenever.
6. **`--afa-terracotta` repo-wide sweep still not done** — confirmed again this session, ~69 files still reference it. Still deliberately out of scope for every dispatch so far; someone needs to actually schedule this as its own pass eventually rather than fixing it file-by-file forever.
7. **`--afa-cream-tint-1/2` repo-wide sweep** — new this session, same shape of problem as `--afa-terracotta`. Fixed on the seat-map canvas (see below) but still live in `SeatPicker.tsx` and `LegalDocLayout.tsx`.
8. **SeatSectionEditor's running-total bar isn't sticky** — minor, non-blocking deviation from the Figma export (Figma's is `sticky bottom-4`, the real one scrolls away). Only matters for venues with many sections. Noted, not fixed, this session.
9. **Remaining pages never reviewed against Figma**: Flexible Requests page, auth pages (login/register/forgot-password/reset-password/verify-email — still fully pre-dark-redesign, flagged as a separate full-page-redesign item, not a token bug).

## Shipped this session

### Billing dashboards — root-caused (not fixed, needs Hitesh)

The "unconfirmed" billing-dashboard item had carried across every session since at least 22 Aug without anyone actually testing the keys end-to-end. This session bypassed the app entirely and hit both real APIs directly with the local `.env.local` credentials:

- **Razorpay**: `401 Authentication failed` (`BAD_REQUEST_ERROR`) straight from `api.razorpay.com`. Network reachability itself is fine (clean 401, not a timeout) — this contradicts a stale comment in `src/lib/razorpay.ts` claiming the sandbox can't reach Razorpay at all. The key/secret pair is just invalid.
- **Google Places**: `400 API_KEY_INVALID` straight from `places.googleapis.com`.

Both need fresh keys from the Razorpay dashboard and Google Cloud Console, pasted into local `.env.local` and Vercel's Preview env. Not a code fix — nothing in the app is broken. Full diagnosis in memory (`project_billing_dashboards_invalid_creds`).

### BUG-2608-098 through BUG-2608-103 — venue-flow live click-through fixes

Hitesh did the real-browser click-through of GEN-2608-082 that was flagged as still-needed at the top of last handoff, found 6 issues, and dispatched them as a single brief covering two parts. Both parts done this session, pushed as separate branches (no PR opened — no `gh` CLI on this machine):

**`fix/bug-2608-098-099-venue-shell`** (low-risk, no design decision):
https://github.com/hiteshshyamchandbanagde-arch/aforaudience/pull/new/fix/bug-2608-098-099-venue-shell
- BUG-2608-098: `FacilitiesPicker`'s free-text "Other" input had no background/color set at all — black-on-black. One-line fix, same `fieldStyle` pattern already used by every other field in the file.
- BUG-2608-099: `dashboard/venue/[id]/page.tsx` never adopted the shared `Card`/`PageHead`/`SectionTitle` system its sibling pages use, and layered its own content on the same `--afa-surface-raised` token as the page background — zero depth. Wrapped in `PageHead` + two `Card` sections, gave chips/rows their own recessed background, swapped the file's `--afa-terracotta` usages for `--afa-fill-solid`. Also investigated the garbage facility value (`bHJbkjxzbJKxbKJXkjxcbn`) flagged alongside this bug: confirmed no seed script produces it, it's genuine test input correctly round-tripped by `FacilitiesPicker` — not a display bug.

**`fix/bug-2608-100-103-seatmap-polish`** (higher-risk, seat-map visual-polish completion):
https://github.com/hiteshshyamchandbanagde-arch/aforaudience/pull/new/fix/bug-2608-100-103-seatmap-polish
- BUG-2608-100: the top-level General Admission / Numbered Seating toggle had zero glow/accent treatment. Added the same `.afa-glow-orange` pattern already used elsewhere plus a new italic-serif accent line.
- BUG-2608-102: two real fixes here. (1) Both the Guided Setup ghost preview and the main seat-grid canvas were rendering on `--afa-cream-tint-1` (#FBF8F3, near-white) — the literal "canvas is a plain white/cream block" bug, confirmed live and in code. Swapped to `--afa-surface-page` plus border-color fixes. (2) Traced the broader "generic dark dashboard, no depth" complaint to its actual root cause: `<main>`'s own background was `--afa-surface-raised`, the *same* token every button/card/pill on the page uses for its own "raised" surface (~15 spots) — all of them were rendering flush against an identically-colored page. Fixed once at the source instead of touching all 15 individual declarations.
- Investigated but left unchanged (already correct, verified live and in code, not re-fixed): BUG-2608-101 (Guided Setup/Draw It Myself choice cards already have glow + icon-tint — the dispatch's reference screenshot describes a 3-card chooser that PR #537 deliberately replaced with this 2-card one, confirmed with Hitesh at the time), `SECTION_TIER_FILLS` (this file's SECTION_PALETTE — confirmed no `#6f8fa8`, amber still accent-only), and BUG-2608-103 (`SeatSectionEditor.tsx` already explicitly ported from the Figma export's `GeneralAdmission.tsx`, confirmed structurally equivalent — see the sticky-bar note above for the one small deviation).

Both branches verified via mocked-session Playwright (screenshots taken at each step) — local DB unreachable again this session (same recurring P1001/ENOTFOUND issue, re-confirmed not a new bug), so this was a real browser render, not a `tsc --noEmit`-only check.

## Explicitly parked / rejected (carried forward, unchanged)

- **GEN-2608-081** — QA seed data country distribution is deliberate multi-country test data (India 933, ~30 each across 7 others), not accidental Faker noise. Powers the country-flag feature. REJECTED as a bug.

## Tally

15 PRs merged total (#527–#537) as of last session — nothing merged this session yet (2 branches pushed, awaiting PR creation/review/merge). Zero reverted so far.
