# Motion Guidelines

UI/UX audit Section 09 / Step 6, sub-spec 1/5 (accessibility, motion, icons,
notifications, onboarding - five one-page specs, same discipline as Step 1's
type-scale spec in `docs/afa-design-tokens-reference.md` Section 8). Written
after Step 5 (`GEN-2609-037`, the seal stamp-in animation) rather than
before it, per the audit's own Section 09 sequencing - informed by the one
animation that already exists instead of speculating ahead of it.

Everything below is confirmed against real `src/app/globals.css` content
(qa @ `4c28487`), not memory or prior handoff text - every duration, easing
curve, and reduced-motion selector was grepped and read directly.

## 1. Pattern catalog

| Keyframe(s) | Class | Duration | Easing | Trigger | Reduced-motion |
|---|---|---|---|---|---|
| `seatIn` | `.afa-seat-anim` | 0.18s | `ease-out` | Structural seat-count/layout change in the live seat-map preview (`seat-map/page.tsx`) | **Not covered** - see Gap 1 below |
| `afa-push-in` | `.afa-push-mount` | 0.3s | `cubic-bezier(0.22, 1, 0.36, 1)` | Full-screen route push-transition, fresh mount, mobile-only (`<1024px`) - EventDetail, Checkout | Covered |
| `afa-sheet-in` | `.afa-sheet-mount` | 0.3s | `cubic-bezier(0.22, 1, 0.36, 1)` | Bottom-sheet fresh mount - mobile filter sheet, `ContributionMoment`'s mobile variant | Covered |
| `afa-backdrop-in` | `.afa-backdrop-mount` | 0.2s | `ease-out` | Backdrop fade-in, always paired with a sheet/modal mount | Covered |
| `afa-seal-stamp-in` | `.afa-seal-stamp-mount` | 480ms | `cubic-bezier(0.34, 1.4, 0.64, 1)` (overshoot) | Contribution-moment seal stamp-in, fresh mount on the booking-confirmation screen | Covered |
| `afa-seal-ring-pulse` | `.afa-seal-ring-mount` | 480ms | `ease-out` | Amber ring pulse paired with the seal stamp | Covered |
| *(none - plain `:hover`)* | `.hover-lift-card` | 0.2s (transition) | implicit `ease` | Directory-grid card hover-lift (Venues/Artists/Events) | Covered |
| *(none - plain `:hover`)* | `.afa-path-card:hover` | 150ms (transition, declared **inline** in `dashboard/venue/create/page.tsx`, not in globals.css) | implicit `ease` | Venue-creation Seating & Pricing path-card hover | **Not covered** - see Gap 2 below |

All five keyframe-driven patterns above use one of exactly two duration
families (0.18-0.3s, or 480ms for the one overshoot-style "moment"
animation) and one of three easing values - see the custom-properties
recommendation in Section 4.

## 2. Naming convention

Fresh-mount CSS animations use `.afa-<context>-mount`, paired with a
`@keyframes afa-<context>-in` (or `-pulse` for a secondary paired effect):
`afa-push-mount`/`afa-push-in`, `afa-sheet-mount`/`afa-sheet-in`,
`afa-backdrop-mount`/`afa-backdrop-in`, `afa-seal-stamp-mount`/
`afa-seal-stamp-in`, `afa-seal-ring-mount`/`afa-seal-ring-pulse`. **New
fresh-mount animations should follow this exact pair.**

Hover-only effects (plain `:hover` + `transition`, no keyframe) don't take
the `-mount` suffix - they're not mount-triggered. Keep naming them with a
plain descriptive class scoped to the component they style, matching
`.hover-lift-card`/`.afa-path-card`.

## 3. Rule for new animations

1. **Reduced-motion**: if the animation lives in `globals.css`, its
   opt-out goes into the single consolidated `@media (prefers-reduced-motion:
   reduce)` block there (currently the last rule in the file) - not a new
   block. If the animation is scoped inside a component via `styled-jsx`
   (see Gap 3 below for why that's sometimes unavoidable), it keeps its own
   local block, but **must still get a row in this doc's Section 1 table**
   so it isn't invisible to future audits.
2. **Duration/easing**: reuse one of the existing duration/easing pairs in
   Section 1 unless there's a stated design reason for a new one (e.g. a
   deliberately distinct "moment" animation, the way the seal stamp's
   overshoot curve was a deliberate departure from the push/sheet standard).
3. **Log it here**: add the row to Section 1's table and a line to the
   "Built" history below, in the same doc update as the merge - same
   standing rule as the rest of this audit's docs.

## 4. Easing custom-properties - recommendation, not implemented

Two curves recur:
- `cubic-bezier(0.22, 1, 0.36, 1)` - used twice (`afa-push-in`, `afa-sheet-in`). A real dedup candidate, e.g. `--afa-ease-standard`.
- `cubic-bezier(0.34, 1.4, 0.64, 1)` - used once so far (`afa-seal-stamp-in`'s overshoot). No dedup benefit yet, but distinctive enough that the next "moment" animation will likely want to reuse it by name rather than retype it, e.g. `--afa-ease-overshoot`.

Flagging rather than implementing: introducing the properties themselves is
trivial, but retargeting the three existing rules to reference them is a
naming decision on a value three animations already depend on - more than
the mechanical, no-behavior-change scope of this pass. Worth doing the next
time a ticket needs one of these curves.

## Gaps found while confirming the catalog (not fixed this pass)

**Gap 1 - `.afa-seat-anim` has no reduced-motion suppression at all.**
Confirmed via grep: none of the three (now one) `prefers-reduced-motion`
blocks in `globals.css` mention `.afa-seat-anim`/`seatIn`, and the only
`matchMedia` call in `seat-map/page.tsx` is an unrelated mobile-breakpoint
check, not a motion check. Real, pre-existing gap - not introduced by this
pass. Not fixed here per scope ("no visual/timing changes to existing
animations").

**Gap 2 - `.afa-path-card:hover`'s transition is inline, not in
globals.css, and uncovered.** `dashboard/venue/create/page.tsx:601`
declares `transition: 'border-color 150ms, transform 150ms'` as a React
inline style on the path-card button, separate from the
`.afa-path-card:hover` rule in `globals.css` that sets the actual
`translateY(-2px)`. No reduced-motion suppression reaches either half. Its
sibling `.hover-lift-card` gets suppression; this one doesn't.

**Gap 3 - a sixth real pattern + a fourth reduced-motion block exist
outside `globals.css`, in the file this very audit step is informed by.**
`ContributionMoment.tsx` (the seal stamp's own component) defines its own
desktop-only modal mount via `styled-jsx`: `@keyframes cm-modal-in` /
`.cm-modal-mount` (0.2s, `ease-out`), with its own
`@media (prefers-reduced-motion: reduce) { .cm-modal-mount { animation:
none; } }` block, scoped locally because `styled-jsx` output can't be
merged into a global stylesheet rule the way the `globals.css` patterns
can. This pass's consolidation (Section 3 of the dispatch) was scoped to
`globals.css` only, so this block wasn't touched - but it's real
fragmentation the audit should know about. Logged in Section 1's table for
visibility; the block itself stays where it is.

**Broader note - not audited, out of scope for this pass.** A repo-wide
grep for `@keyframes`/`prefers-reduced-motion` outside `globals.css` found
roughly 19 more `src/` files with at least one hit (`Hero.tsx`, `Toast.tsx`,
`AuthPromptSheet.tsx`, `OrganisersGridEmbed.tsx`,
`VenueOwnersGridEmbed.tsx`, `VenuesGridClient.tsx`, `TonightNearYou.tsx`,
`NearYouTabs.tsx`, `ArtistsNearYou.tsx`, `usePhotoRotation.ts`,
`PhotoRotationDots.tsx`, `layout.tsx`, and several `page.tsx` files), plus
unrelated legacy exports under the untracked `Figma/` directory. This
dispatch's scope was `globals.css` specifically (per Step 1's own model: a
tight, real-data-grounded slice, not a sweep); a full codebase motion
inventory across component-scoped styles would be a good Step 6 follow-up
if one is wanted, but wasn't attempted here.

## Built

- **12 Sep 2026** - reduced-motion consolidation: 3 separate
  `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` (one
  added per animation batch as each shipped - `.hover-lift-card`,
  `.afa-push-mount`, then `.afa-sheet-mount`/`.afa-backdrop-mount`/
  `.afa-seal-stamp-mount`/`.afa-seal-ring-mount`) merged into one. Verified
  via diff: same five selector groups, same declarations, nothing dropped.
