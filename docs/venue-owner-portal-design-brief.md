# Venue Owner Portal — Design Brief

**Status:** New — this brief did not previously exist in the repo despite being referenced as "already written" in the 22 Aug handoff. Written fresh this session, sourced from `docs/afa-design-tokens-reference.md` (committed `3c7b833`) and the real shipped code under `src/app/dashboard/venue/`. No guessed values.

## Problem

Hitesh flagged the live Venue Owner dashboard as the visual odd-one-out on the platform: plain white calendar grid, default form styling, an almost-empty revenue chart, no illustration/duotone treatment anywhere. Functionally solid — booking flow, revenue tracking, flex requests all work — but has never had a design pass. Six real screens, mapped to actual files:

1. **Your Venues** — `src/app/dashboard/venue/page.tsx`
2. **Edit Profile** — `src/app/dashboard/venue/edit/page.tsx`
3. **Revenue Overview** — `src/app/dashboard/venue/sales/page.tsx`
4. **Booking Requests (calendar)** — `src/app/dashboard/venue/bookings/page.tsx`
5. **Flexible Requests** — `src/app/dashboard/venue-requests/page.tsx` — **its own top-level route**, not nested under `dashboard/venue/`. Confirmed by grep: `dashboard/venue/page.tsx` links to it at `href="/dashboard/venue-requests"` with a `pendingFlexRequests` count badge (line ~203-208).
6. **Register Venue form** — `src/app/dashboard/venue/create/page.tsx`

**Additional finding from confirming the above:** `dashboard/venue/page.tsx`'s pending-count badges (Booking Requests, Flexible Requests) and the "+ Register Venue" CTA are hardcoded to `background: 'var(--afa-terracotta)'` — a **stale pre-Phase-2c token** per `docs/afa-design-tokens-reference.md`, the same class of leftover that had to be removed from `OrganisersGridEmbed` this session. This isn't just "needs polish," it's running partially on retired tokens. Swap to `--afa-fill-solid`/current token family as part of this pass, not just the illustration/layout work.

## Critical constraint — dashboards are NOT the public sharp-corner system

Per `docs/afa-design-tokens-reference.md` §7, the existing dashboard family (`dashboard/organiser`, `dashboard/venue`, `dashboard/artist`, `dashboard/admin`) already has its own established, coexisting convention — **rounded corners, not sharp**:

- Cards: `border-radius: 12px` (not 0, unlike Venues/Events/Artists public cards)
- Status pills: `border-radius: 999px` (fully rounded)
- Card border: flat `1px solid rgba(245,245,240,0.08)`, no amber hover treatment (dashboards aren't hover-interactive discovery grids)
- Fill: `var(--afa-surface-raised)`

**This brief's job is to bring visual polish and illustration to the dashboard family's own existing rounded convention — not to port the public-site sharp-corner system onto it.** That would be reconciling two systems that are deliberately different, which is explicitly the wrong move per the tokens reference.

## What to bring

- **Status badge system** — reuse the real `STATUS_STYLE` lookup pattern from `dashboard/organiser/page.tsx` (DRAFT/APPROVED/PENDING_APPROVAL/CANCELLED/COMPLETED, each with its own bg/color/label) rather than inventing new badge colors for booking/flex-request statuses.
- **Illustrated empty states** — reuse the `VenueNoPhoto`-style pattern (base fill + graph-paper crosshatch texture at `opacity: 0.04` + capacity-tiered line-art mark in amber at `opacity: 0.55` + mono-font caption) for: no venues yet, no bookings yet, empty revenue period. Swap only the icon/mark, keep the base treatment — no stock photos, no emoji, consistent with the rest of the platform.
- **Typography** — `--font-display` (Newsreader) for page/section headers only; `--font-mono` (IBM Plex Mono) for labels, stats, prices, badges; `--font-sans` (Manrope) for body/form copy. Same three-tier system as the public site.
- **Revenue chart** — currently "almost empty" per Hitesh's screenshots; needs a real chart treatment (not necessarily new data, just visual weight — gridlines, amber accent line/bars, mono-font axis labels) so it doesn't read as broken/unfinished.
- **Calendar (Booking Requests)** — currently a plain white grid; needs to move onto dark surface tokens (`--afa-surface-page`/`--afa-surface-raised`) with status-colored day cells matching the badge system above, not a redesign of the calendar's underlying interaction model.
- **Forms (Edit Profile, Register Venue)** — bring onto `--afa-surface-raised` panels, `--afa-cream`/`--afa-text-secondary` label hierarchy, existing input chrome patterns already used elsewhere in the app (check `dashboard/organiser` or public-site forms for the actual input component styling before inventing new field chrome).

## Explicitly out of scope

- Changing the sharp-corner public system to match dashboards, or vice versa — both conventions stay as-is, this brief only polishes within the dashboard convention.
- New functionality, new data fields, or interaction/flow changes — this is a visual pass on existing, working screens.
- Mobile app — this brief is web dashboard only.

## Next step

Run as a Figma Make prompt covering all 6 screens as one cohesive portal (matching the two-step process used for prior Figma Make rounds: brief → prompt → generate → verify against raw export before treating as a build reference, per the project's established discipline that Figma Make's self-reported state isn't trustworthy).
