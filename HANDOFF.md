# Session Handoff — 29 Aug 2026 (homepage bento no-poster fallback: emoji → EventTypeIcon → IllustratedEventFallback)

`qa` HEAD: `be551ef` (#538, #539, #540 all merged since last handoff — the two venue-flow branches from 25 Aug plus this session's first fix). One more branch from this session is pushed and awaiting review/merge (see below).

## 🔴 Next session — priority order

1. **Merge `fix/homepage-bento-illustrated-fallback`** (pushed this session, not yet merged):
   https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/qa...fix/homepage-bento-illustrated-fallback?expand=1
   Single file (`src/app/page.tsx`). Swaps the bare `EventTypeIcon` (this session's first fix, already merged as #540) for the same `IllustratedEventFallback` the events listing page/EventCard/detail pages use, so the homepage's no-poster state matches its sibling instead of looking sparse. **Read the "Shipped this session" section below before merging** — a real text-overlap bug was found and fixed mid-session (bottom clearance per tile size), and there's an open design question about the fix's tradeoff (flat-color seam vs. an alternative that'd touch the shared component) that Hitesh should weigh in on rather than just rubber-stamping the diff.
2. **Rotate Razorpay + Google Places credentials** — root-caused 25 Aug, still unresolved, only Hitesh can fix (needs dashboard/console access). Both keys are confirmed dead (401/400 direct from the APIs), not a plumbing bug.
3. **`dashboard/admin/settings/page.tsx` has no dark shell at all** (found 23 Aug, still not fixed — needs an actual dark-shell pass, not a token swap). Screenshot proof in PR #535's description.
4. **`src/components/Toast.tsx` appears light-themed** (found 23 Aug, still not investigated). Visibly inconsistent with the dark `ErrorBanner` shown for the same message on the same page.
5. **BUG-2608-091 / BUG-2608-090** — small, queued, not dispatched. Past Requests rows missing date/time; a stat-card subtitle sitting on the wrong card. Pick up whenever.
6. **`--afa-terracotta` repo-wide sweep still not done** — ~69 files as of 25 Aug. Still deliberately out of scope for every dispatch so far; needs to actually be scheduled as its own pass rather than fixed file-by-file forever.
7. **`--afa-cream-tint-1/2` repo-wide sweep** — same shape of problem as `--afa-terracotta`. Fixed on the seat-map canvas (25 Aug) but still live in `SeatPicker.tsx` and `LegalDocLayout.tsx`.
8. **SeatSectionEditor's running-total bar isn't sticky** — minor, non-blocking deviation from the Figma export (Figma's is `sticky bottom-4`, the real one scrolls away). Only matters for venues with many sections.
9. **Remaining pages never reviewed against Figma**: Flexible Requests page, auth pages (login/register/forgot-password/reset-password/verify-email — still fully pre-dark-redesign, flagged as a separate full-page-redesign item, not a token bug).
10. *(Trivial, optional)* the now-merged `fix/homepage-bento-emoji-fallback` remote branch is stale and can be deleted from GitHub whenever.

## Shipped this session

### Homepage bento tiles — emoji fallback fixed in two passes

**First fix (`fix/homepage-bento-emoji-fallback`, merged as #540):** Hitesh flagged (via screenshot) that the homepage "Happening soon" bento tiles showed raw emoji (😂/🎤/📜) for events with no poster image, while every other no-poster state in the app (`IllustratedEventFallback` in `EventCard.tsx`) had already moved to a line-art `EventTypeIcon` SVG set. Swapped `TYPE_META[type].emoji` for a bare `EventTypeIcon`, sized/colored to match `IllustratedEventFallback`'s existing amber treatment (confirmed amber — not orange — is what the reference implementation actually uses for this state, despite amber being secondary-only in the 4-color palette generally). Also confirmed during this pass: the Prisma `EventType` enum only has `OPEN_MIC / STAND_UP / POETRY / THEATER / LINEUP` — no `MUSIC` or `DANCE` type exists anywhere in this codebase, so a comedy/poetry/music/dance framing from an earlier ask didn't map onto anything real. Grepped all of `src/` for other per-type emoji-icon patterns; found none — this was the only instance.

**Second fix (`fix/homepage-bento-illustrated-fallback`, pushed, not yet merged):** Hitesh compared the fixed homepage against the events listing page and flagged the bare-icon fallback as still reading "damaged"/thin next to the richer treatment everywhere else — a warm dark backdrop, radial-circle line pattern, and "NO POSTER · TYPE" caption that `EventTypeIcon` alone doesn't have. Root cause: the first fix used the icon directly instead of the full `IllustratedEventFallback` component. Swapped in `IllustratedEventFallback` directly (imported from `EventCard.tsx`, no new plumbing needed — `typeLabel` was already computed in `BentoTile`).

**Found mid-fix, not anticipated going in:** dropping `IllustratedEventFallback` in at full `inset: 0` (matching how the bare icon was positioned) caused its own vertically-centered "NO POSTER · TYPE" caption to collide with `BentoTile`'s bottom-anchored title/venue text — both are separate absolutely-positioned layers stacked on the same tile. `EventCard.tsx` never hits this because it always confines the fallback to a dedicated poster box, physically separate from the card's (non-overlaid) text below. First verification screenshot showed genuinely overlapping, unreadable text on 3 of 4 tile sizes (medium/strip; large tile was fine — matches what the original ask suspected but got backwards, it flagged large as the one to eyeball).

Fixed by wrapping the fallback in a container with per-tile-size bottom clearance (110px large / 100px strip / 95px medium, sized off the actual computed height of each tile's text block) — zero changes to the shared component. **Tradeoff worth a second look:** this clips the radial pattern short of the tile's bottom edge, leaving a visible flat-color band (the tile's own `meta.color`) between the pattern and the text. Not a functional bug and still far richer than the bare-icon version, but not a pixel-perfect match to the events listing page's edge-to-edge treatment either. The alternative — adding an optional `hideCaption` prop to `IllustratedEventFallback` so BentoTile can drop the now-redundant caption (it already shows type+venue in its own overlay text) and let the pattern run the full tile height uninterrupted — was scoped out as a shared-component change rather than a page.tsx-only one, and left for Hitesh to decide on rather than assumed.

Both passes verified via mocked-session Playwright in an isolated git worktree (screenshots at each step, all 5 real event types covered) — local dev environment has two unrelated pre-existing issues that block a plain `npm run dev` render: the local DB is unreachable (recurring P1001, known from prior sessions) and `.env.local`'s `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are not validly formatted (new finding this session — breaks `/api/events` with a 500 even before hitting the DB). Worked around both for verification only (mocked `/api/events` responses, throwaway VAPID keys passed as env overrides, never written to `.env.local`) rather than fixing either — out of scope for this dispatch, flagging here in case they recur and waste time re-diagnosing. Full detail on both in memory.

## Explicitly parked / rejected (carried forward, unchanged)

- **GEN-2608-081** — QA seed data country distribution is deliberate multi-country test data (India 933, ~30 each across 7 others), not accidental Faker noise. Powers the country-flag feature. REJECTED as a bug.

## Tally

18 PRs merged total (#527–#540) as of this session. 1 branch pushed, awaiting review/merge (`fix/homepage-bento-illustrated-fallback`). Zero reverted so far.
