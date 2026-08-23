# AFA Design Tokens & Patterns — Reference

Sourced from the shipped codebase only (`src/`), as of qa @ 1524eab. No aspirational or Figma-only values — anything under `Figma/` (untracked exports) is excluded. Line refs point at real usages.

## 1. Core `--afa-*` tokens

Defined in [globals.css](../src/app/globals.css#L51). Current default theme is **Theme Phase 2c**, a dark stage-lit reskin (Hitesh's call, "the new default, not opt-in") — these are live values, not a light-theme legacy:

```css
--afa-surface-page:    #141414;   /* page background */
--afa-surface-raised:  #1F1F1F;   /* elevated panel — cards, chips, fallback panels */
--afa-surface-inverse: #0A0A0A;   /* deliberately deeper band — footer, ticker, splash, nav-scrim */

--afa-cream:           #F7F3EE;   /* primary text-on-dark color, NOT a light background anymore */
--afa-amber:           #C9973A;   /* accent — eyebrows, icons, hover states, badges */
--afa-amber-tint:      #FFF8E1;

--afa-fill-solid:      #FF5A36;   /* bright accent for solid CTA fills (Phase 2c) */
--afa-on-fill-solid:   var(--afa-brown-black);  /* text color on top of fill-solid */

--afa-text-primary:    #F5F5F0;
--afa-text-secondary:  rgba(245, 245, 240, 0.65);
--afa-text-muted:      rgba(245, 245, 240, 0.4);
```

**Borders**: there is no single `--afa-border` token. In practice, borders are hand-authored `rgba(245,245,240, α)` (translucent cream-on-dark) at low opacity for resting state, with `--afa-amber` (or `rgba(201,151,58, α)`) on hover/focus:

- Card resting border: `1px solid rgba(245,245,240,0.1)` ([VenuesGridClient.tsx:94](../src/app/venues/VenuesGridClient.tsx#L94))
- Card hover border: `rgba(201,151,58,0.6)` (amber, same rule)
- Button border: `1.5px solid rgba(201,151,58,0.5)` (Get Directions) or `1.5px solid var(--afa-fill-solid)` (Follow, when active)
- Divider rule (footer of event card): `1px solid rgba(245,245,240,0.1)`

## 2. Typography

Wired in [layout.tsx](../src/app/layout.tsx#L19-26) via `next/font`:

| Variable | Typeface | Role |
|---|---|---|
| `--font-display` | Newsreader (serif, optical sizing, real italics) | Headlines only — venue/event/artist names, page H1s |
| `--font-sans` | Manrope (+ per-script Noto Sans fallback chain for non-Latin) | Body copy, form inputs, descriptions, UI chrome |
| `--font-mono` | IBM Plex Mono (weights 400/500/600) | Eyebrows, labels, badges, prices, stats — never body text |

Real examples:
- Venue detail H1: `font-family: var(--font-display); font-size: clamp(40px, 6vw, 72px); font-weight: 500; letter-spacing: -0.02em; line-height: 0.95` ([VenueDetailClient.tsx:138](../src/app/venues/[id]/VenueDetailClient.tsx#L138))
- Venue card title: `font-family: var(--font-display); font-size: 26px; line-height: 1.05; letter-spacing: -0.01em`
- Event card title: `font-family: var(--font-display); font-size: 24px` (grid) / `22px` (list) ([EventCard.tsx:268](../src/components/EventCard.tsx#L268))
- Eyebrow (city/tier label above venue H1): `font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--afa-amber)`
- Event type badge / price / seat count: `font-family: var(--font-mono); font-size: 11-13px`
- Body/address text: `font-family: var(--font-sans); font-size: 15-17px` (inherited from `html { font-family: var(--font-sans)… }` in globals.css, or set explicitly per component)

## 3. Card pattern (VenueCard / EventCard)

**Sharp corners are the explicit, enforced house convention** — confirmed in three separate fix briefs, not a guess:
- `docs/venues-figma-fidelity-fix-brief.md`: *"Same sharp-edged signature as the card grid… all use zero border-radius in the export. The live build's `borderRadius: "12px"`… should come out."*
- `docs/venue-owner-card-fix-brief.md`: *"Sharp corners, not rounded… Export: no radius anywhere."*
- [VenueFollowButton.tsx:85](../src/app/venues/[id]/VenueFollowButton.tsx#L85): *"export's Follow buttons are sharp-edged, this used to be a rounded-999px pill"*

Real card values:
- **Border**: `1px solid rgba(245,245,240,0.1)` resting → `rgba(201,151,58,0.6)` on hover, transition `border-color 0.3s ease`
- **Corner radius**: none set (0) on `.afa-venue-card`. EventCard uses a near-zero `3px` on its own card ("this export's own signature," per its code comment — a deliberately confirmed exception, not the Venues zero-radius rule assumed to carry over)
- **Padding**: content block `14px 18px 20px` below the media (Venue card); EventCard: `20px` (grid) / `16px` (list)
- **Hover state**: `.hover-lift-card` class → `transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.1)`, transition `transform 0.2s, box-shadow 0.2s` ([globals.css:283](../src/app/globals.css#L283)); title color transitions to `--afa-amber`; a hidden arrow icon fades to `opacity: 1`
- Background fill: `var(--afa-surface-raised)`

## 4. Button conventions

**Follow / Get Directions chrome** (BUG-2608-076 — the pattern both were normalized to):
```css
padding: 10px 20px;
border: 1.5px solid rgba(201,151,58,0.5);   /* or var(--afa-fill-solid) when Follow is active */
font-size: 13px;
font-weight: 600;
/* no border-radius — sharp corners */
```
Follow button toggles fill: unfollowed = solid `background: var(--afa-fill-solid)`, `color: var(--afa-on-fill-solid)`, `border: none`; followed = `background: transparent`, `border: 1.5px solid var(--afa-fill-solid)`, `color: var(--afa-fill-solid)` ([VenueFollowButton.tsx:101-110](../src/app/venues/[id]/VenueFollowButton.tsx#L101)).

**`.afa-cta-solid`** (Artists pages — [ArtistProfileClientPage.tsx](../src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx#L602)): solid-fill button/link variant.
```css
background: var(--afa-fill-solid);
color: var(--afa-on-fill-solid);
padding: 8px 18px;      /* or 12px for full-width variants */
border-radius: 6px;     /* NOTE: this variant IS rounded — an exception to the sharp-corner card/Follow rule, confirmed in its own file, not a contradiction to resolve */
font-size: 12px;
font-weight: 700;
```
Hover: `filter: brightness(1.1)` (not a color/border change).

No `.afa-cta-outline` class currently exists in `src/` — only `.afa-cta-solid` is a real, reusable class name.

## 5. Status badge / pill pattern

Live in the **Organiser dashboard** ([dashboard/organiser/page.tsx:24-30](../src/app/dashboard/organiser/page.tsx#L24)) — a `STATUS_STYLE` lookup keyed by backend status, each with its own `bg`/`color`/`label`:

```js
DRAFT:            { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)',        label: 'Draft' }
APPROVED:         { bg: 'rgba(74,103,65,0.12)',  color: 'var(--afa-sage)',        label: 'Published' }
PENDING_APPROVAL: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)',        label: 'Pending' }
CANCELLED:        { bg: 'rgba(179,38,30,0.1)',   color: 'var(--afa-error)',       label: 'Cancelled' }
COMPLETED:        { bg: 'rgba(245,245,240,0.08)',color: 'var(--afa-text-primary)',label: 'Completed' }
```
Pill chrome (shared, applied inline at the call site — not its own reusable class):
```css
font-size: 11px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 5px 10px;
border-radius: 999px;   /* NOTE: fully rounded pill — dashboard badges are NOT under the sharp-corner card rule */
white-space: nowrap;
```
The visible "PUBLISHED" label in data (venue `status` field, per `docs/design.md`'s incident notes) maps to this same badge family — the dashboard's `APPROVED` → `"Published"` row is the shipped analog; there's no separate literal `PUBLISHED`-labeled badge component.

## 6. Illustrated no-photo fallback (reuse candidate for dashboard empty states)

[VenueNoPhoto.tsx](../src/components/VenueNoPhoto.tsx) (venues) and the equivalent `ArtistNoPhoto.tsx` (artists) — **not** literally named "VenueFallback" in current source (that was the Figma export's name; the shipped component is `VenueNoPhoto`, default export).

Structure, full-bleed (`position: absolute; inset: 0`):
1. Base fill: `background: var(--afa-surface-raised)`
2. Grid/graph-paper texture layer: two 1px `var(--afa-cream)` linear-gradients (one vertical, one horizontal) on a `22px 22px` cell, `opacity: 0.04` — a genuine crosshatch, not an image asset
3. A capacity-tiered illustrated line-art mark (`IntimateRoomMark` / `MidHallMark` / `LargeArenaMark`, seeded per-venue-id for variation), `color: var(--afa-amber)`, `opacity: 0.55`
4. Optional caption: `font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.04em; color: var(--afa-cream); opacity: 0.4; text-transform: uppercase`

This is the correct pattern to reuse for a dashboard/portal empty state (no stock photos, no emoji) rather than inventing a new illustration language — swap only the tier-mark SVG for a dashboard-relevant icon if needed, keep the base fill + texture + caption treatment.

## 7. Existing dashboard/portal pages to match

Real, shipped dashboards already exist under `src/app/dashboard/` — this is **not** greenfield:
- `dashboard/organiser/page.tsx` — organiser's event list, wallet/payout status, flex-request count
- `dashboard/venue/page.tsx` — venue owner dashboard (bookings, flex requests)
- `dashboard/artist/page.tsx`, `dashboard/admin/*`, `dashboard/messages/*` — same family

**Important, non-obvious finding**: the dashboard family does **not** follow the public-site sharp-corner rule. Its event cards use `borderRadius: '12px'` and its status pills use `borderRadius: '999px'` ([dashboard/organiser/page.tsx:223,235](../src/app/dashboard/organiser/page.tsx#L223)) — rounded corners throughout, unlike Venues/Events/Artists cards. Card border there is also a flat `1px solid rgba(245,245,240,0.08)` with no amber hover treatment (dashboards aren't hover-interactive card grids the way public directories are).

**Implication for new dashboard work**: match the *existing dashboard* convention (rounded `12px` cards, `999px` pills, flat borders, `--afa-surface-raised` fill) rather than the public-site sharp-corner rule — they are two deliberately different, already-coexisting systems in this codebase, not one the other should be reconciled toward.
