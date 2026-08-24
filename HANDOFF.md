# Session Handoff — 24 Aug 2026 (Figma-first workflow adopted + Venue Seating redesign shipped)

`qa` HEAD: `2fdfe60` — last code commits: PR #536 + PR #537 (GEN-2608-082, Venue Creation + Seat Arrangement Figma redesign, both merged)

## 🔴 Next session — priority order

1. **Razorpay / Google Maps billing dashboards** — still unconfirmed, now carried across every session this month. Please actually check these before anything else.
2. **Live click-through of GEN-2608-082** — everything shipped via `tsc --noEmit` + mocked-session Playwright, never a real browser. Specifically verify: the Seat Map Builder's Guided Setup panel (all fields now live-editable at once, not step-gated — confirm the ghost preview updates on every keystroke without touching real seats), the "Generate / Update Layout" button (must stay an explicit click — confirm it doesn't silently overwrite hand-placed/dragged seats), and the Terminology slide-over inside the builder.
3. **`dashboard/admin/settings/page.tsx` has no dark shell at all** (found 23 Aug, still not fixed — needs an actual dark-shell pass, not a token swap). Screenshot proof in PR #535's description.
4. **`src/components/Toast.tsx` appears light-themed** (found 23 Aug, still not investigated). Visibly inconsistent with the dark `ErrorBanner` shown for the same message on the same page.
5. **BUG-2608-091 / BUG-2608-090** — small, queued, not dispatched. Past Requests rows missing date/time; a stat-card subtitle sitting on the wrong card. Pick up whenever.
6. **`--afa-terracotta` audit** — GEN-2608-082 fixed every remaining instance in `SeatSectionEditor.tsx` and `seat-map/page.tsx` (the two files it touched), but did NOT do a repo-wide sweep. If `--afa-terracotta` shows up as a primary-CTA color anywhere else, that's the same old-orange-vs-locked-palette mismatch, not a new bug.
7. **Remaining pages never reviewed against Figma**: Flexible Requests page, auth pages (login/register/forgot-password/reset-password/verify-email — still fully pre-dark-redesign, flagged as a separate full-page-redesign item, not a token bug).

## New standing rules this session — apply going forward

- **All design work — any size — goes through Figma Make first, no exceptions by default.** Agreed exception: skip Figma only when a fix has no design decision in it, i.e. it's copying an already-established value onto something that's clearly supposed to match it (e.g. "make X the same color as its sibling Y three lines down"). If there's a real choice being made — new interaction, new visual treatment, new copy — it goes through Figma even if the diff is one line.
- **Coding still always routes through Claude Code**, mobile exception unchanged.
- **Repo-wide grep for deprecated tokens before closing any theme/token-migration bug** (added 23 Aug, reinforced this session) — a page-level or component-level fix is not "done" until you've grepped all of `src/` for the specific token, not just the files already suspected.

## Shipped this session — GEN-2608-082, Venue Creation + Seat Arrangement redesign

Full arc: two-round Figma Make design process → verified against exported code (not screenshots) both rounds → two Claude Code PRs → one real merge conflict resolved.

**Figma round 1**: unified the seat-map builder into one live-canvas tool instead of a 5-step no-preview wizard handing off to a separate "advanced" editor — this was the actual UX problem, not a style issue. Established Section/Aisle/Level/Seat as the one-word-per-concept vocabulary (was Zone/Tier/Walkway/Gangway inconsistently). Terminology reference screen designed to document this.

**Figma round 2** (scoped fix, not a redo): found via direct code inspection — not screenshot-eyeballing — that round 1 had invented an off-brand color (`#6f8fa8`, a blue-grey, for a 3rd seating section) and was using amber as a large fill instead of an accent. Both fixed: palette is now orange-opacity-steps for tiers with amber reserved for a small marker/accent role. Also added real AFA visual personality (radial-glow depth classes, italic-serif accent copy) that was missing from round 1 — confirmed these were actually wired into the screens, not just defined-and-unused.

**PR #536** (Register Venue + GA, low-risk, merged clean): ports Figma's visual/copy/interaction layer onto the real form — no data model changes, `/api/venues` call untouched. Also fixed `--afa-terracotta` → `--afa-fill-solid` on `SeatSectionEditor.tsx`'s remaining CTAs.

**PR #537** (Seat Map Builder, high-risk — 2,313-line file with real backend wiring): Claude Code flagged the risk itself rather than me having to catch it, and made one real judgment call worth knowing about — flattened the 6-step gated wizard into one continuous always-editable panel, since the step-gating *was* the "no spatial feedback" problem the redesign exists to fix. Confirmed this with Hitesh before doing it (per the commit message) rather than assuming. Deliberately did NOT make `generateGrid()` live-replace on every keystroke the way Figma's mock does — kept "Generate / Update Layout" an explicit click, because the real function's append+collision-guard (protects hand-placed/dragged seats from being silently overwritten) would otherwise have been defeated. This is real backend-aware judgment, not blind Figma-porting.

Both PRs' key claims were verified against the raw diff before merging, not taken on trust: `seatMapFrozen` still referenced 22×, zero `fetch`/API lines touched in either PR, `generateGrid()`'s collision-guard comment intact.

**The one real merge conflict**: both branches had independently added the same icon set to `VenuePortalUI.tsx` (both cut fresh off `qa` before either merged, per the standing branching rule — correct behavior, not a mistake). Resolved directly via a local clone + merge rather than punting back to Claude Code: diffed the two pre-merge versions byte-for-byte and confirmed the *only* difference was one now-stale forward-looking code comment, zero actual code divergence. Pushed the resolved merge commit, CI re-ran green, then squash-merged normally.

## Explicitly parked / rejected (carried forward, unchanged)

- **GEN-2608-081** — QA seed data country distribution is deliberate multi-country test data (India 933, ~30 each across 7 others), not accidental Faker noise. Powers the country-flag feature. REJECTED as a bug.

## Tally

15 PRs merged total (#527–#537), zero reverted. This session: 2 PRs (GEN-2608-082), one real merge conflict resolved cleanly, two Figma Make design rounds completed and verified against actual exported code both times.
