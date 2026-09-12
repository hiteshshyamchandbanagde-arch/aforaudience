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

## 8. Type Scale & Spacing Grid (proposed, 12 Sep 2026 — UI/UX audit Section 06 / 12 Step 1)

**Spec only — nothing below has been applied to any component yet.** Derived from grepping every shipped `font-size`/`fontSize` and `padding`/`margin`/`gap` value in `src/`, not assumed. Source: `docs/afa-uiux-design-audit.md`, qa @ `4456f3b`.

### 8.1 Type scale

Grep across `src/` (~1,621 `font-size`/`fontSize` hits) found this real distribution — the scale below is derived from it, not picked first and fitted after:

| px | Count | | px | Count |
|---|---|---|---|---|
| 13 | 399 | | 18 | 48 |
| 14 | 286 | | 20 | 40 |
| 12 | 276 | | 24 | 31 |
| 11 | 183 | | 22 | 28 |
| 15 | 67 | | 17 | 25 |
| 10 | 57 | | 32 | 22 |
| 16 | 55 | | 9 | 15 |

Long tail (low-frequency, not part of the proposed scale): 28/30/34/36px large-heading one-offs, and decimal hand-tunings (9.5/10.5/11.5/12.5/13.5px, 36 hits combined) — these read as freehand adjustments around the sizes above, not a separate tier.

Proposed 6-step scale:

| Token | px | Weight | Line-height | Use |
|---|---|---|---|---|
| `--afa-text-micro` | 11px | 700 | 1.2 | Eyebrows, uppercase meta labels, tiny badge/count text |
| `--afa-text-small` | 12px | 700 / 500 | 1.3 | Secondary text, captions, small pills |
| `--afa-text-ui` | 13px | 600 / 700 | 1.3 | Buttons, nav items, form labels — the single most common size shipped |
| `--afa-text-body` | 14px | 400 | 1.6 | Paragraphs, descriptions, primary reading text |
| `--afa-text-title` | 16px | 500 / 600 | 1.2 | Card titles, list-item titles (absorbs the 15–19px band) |
| `--afa-text-heading` | 24px | 500 | 1.05 | H3/H4, section subheads (absorbs the 20–24px band) |

Weight and line-height per level are likewise grepped, not guessed: `fontWeight` clusters at 700 (415), 600 (364), 500 (62), 400 (42); `lineHeight` clusters at 1.6 (51, body), 1 (31, tight/display), 1.5 (18), 1.4 (15), 1.2 (9).

**Genuinely not covered — flagged, not silently folded in:**
- Hero/display H1s (`Hero.tsx`, `VenueDetailClient.tsx`, `ArtistProfileClientPage.tsx`, `about/page.tsx`, 15+ more) — every one is its own bespoke `clamp()`, ranging clamp-min 16–48px to clamp-max 18–104px, no two pages share the same values. This is the still-open "Heading scale (H1–H4)" gap from audit Section 02 — a fluid display scale is its own follow-up, not something this 6-step body/UI scale should absorb.
- `src/app/api/posters/**` (40/52/56/62/68/84px) — server-rendered OG/poster images, a canvas rendering surface, not UI.
- One-off marketing display text: `ComingSoon.tsx` (36px), `CorporateInquiryModal.tsx` (40px), `FourRooms.tsx` (56px).

### 8.2 Spacing / 8px grid

Grep across the highest-traffic layout components (`EventCard.tsx`, `HomeHeader.tsx`, `SiteNav.tsx`, `DashboardShell.tsx`, `MobileTabBar.tsx`, `MobileTopBar.tsx`) found real `padding`/`margin`/`gap` values across the full `0–28px` range with no consistent base unit.

Proposed 6-step, 8px-based scale (stops where the real data stops — no invented top end):

| Token | px | Use |
|---|---|---|
| `--afa-space-1` | 4px | Icon-to-text gaps, tight inline spacing |
| `--afa-space-2` | 8px | Default gap between related elements |
| `--afa-space-3` | 12px | Card internal padding (top), stacked-block gaps |
| `--afa-space-4` | 16px | Card padding, section gaps |
| `--afa-space-5` | 20px | Page-section padding, larger gaps |
| `--afa-space-6` | 24px | Wide layout gaps, generous section padding |

**Named exceptions — real, repeated conventions, not one-off noise, so not silently rounded onto the grid above:**
- `9px 16px` / `9px 20px` compact pill/menu-row padding — identical in `HomeHeader.tsx` and `SiteNav.tsx` (4+ sites)
- `6px 0` dropdown-divider margin — identical in `HomeHeader.tsx` and `SiteNav.tsx` (4+ sites)
- `1px 5px` / `1px 7px` / `2px 7px` notification-count badge padding — identical across `DashboardShell.tsx`, `SiteNav.tsx`, `MobileTabBar.tsx` (5+ sites)

**Breakpoint / gutter note:** the only cross-codebase-confirmed breakpoint is the existing `1023px` mobile/desktop nav split (already documented, audit Section 04) — page-level side gutters aren't a real, repeated pattern the way the spacing values above are, so no gutter token is proposed here rather than inventing one. Container `maxWidth` values are wildly inconsistent (1400/1360/1240/1200/1000/900/800/760/700/680/640/600/560/520/480/440/420px, 38 occurrences, no single dominant value, though 760px (19 occurrences) and 600px (10) recur more than the rest) — a separate, larger problem than this grid spec addresses; flagged as its own follow-up, not attempted here.

**Adoption note:** 11 files (`MobileTabBar.tsx`, `DashboardShell.tsx`, all `(auth)` pages, some admin pages) already use Tailwind utility spacing classes (`px-3`, `gap-2`, `mb-1.5`) alongside the inline `style={{ padding: "Npx" }}` convention used everywhere else — two coexisting mechanisms to account for when retrofitting, not just one.

### 8.3 Affected components — follow-up scope, not touched in this pass

Retrofitting is explicitly out of scope for this spec. Components with the heaviest off-scale usage, for whoever picks up the retrofit next:

- `HomeHeader.tsx`, `SiteNav.tsx` — heaviest concentration of both off-grid spacing (9px/6px conventions above) and the full font-size range 10–24px in one file
- `EventCard.tsx` — grid/list dual layout, its own `3px` corner-radius exception already noted in Section 3 above
- `DashboardShell.tsx`, `MobileTabBar.tsx`, `MobileTopBar.tsx` — badge/pill micro-padding exceptions
- `FeedbackTrends.tsx`, `FeedbackDetailPanel.tsx` — 25+ font-size declarations between them, no shared sizing today (also carries pre-existing legacy-token debt, per `HANDOFF.md`)
- `RegisterForm.tsx`, `(auth)/login/page.tsx` — 20+ font-size declarations each, almost entirely 12–15px freehand values that would cleanly land on the new `--afa-text-small`/`--afa-text-body` tokens
- All hero components (`Hero.tsx`, `VenueDetailClient.tsx`, `ArtistProfileClientPage.tsx`, `VenuesHero.tsx`, `ArtistHero.tsx`, `FourRooms.tsx`, `about/page.tsx`, `organisers/[id]/page.tsx`, `events/page.tsx`, `events/[id]/EventDetailClientPage.tsx`) — every H1 `clamp()`, blocked on the separate display-scale decision noted in 8.1

### 8.4 Page-title tier (discovered 12 Sep, auditing the 28px/30px hits excluded from 8.1's scale)

A fourth, real tier sitting between `--afa-text-heading` (24px) and the hero/display `clamp()` gap — every internal dashboard page's own `<h1>` title, grepped and eyeballed one by one (no screenshots needed - unambiguous from code context in every case: single page-level `<h1>`, `Georgia, serif`, sitting above a descriptive paragraph, usually below a `BackLink`/breadcrumb, inside `DashboardShell` or an equivalent centered utility-page layout).

**17 hits across 16 files** (`dashboard/admin/settings/page.tsx` has two - a forbidden-state h1 and the real page h1, in separate render branches):

| Value | Count | Files |
|---|---|---|
| **28px** | 9 | `events/[id]/rate/RatePromptClientPage.tsx`, `verify-phone/page.tsx`, `dashboard/admin/settings/page.tsx` (forbidden state), `my-feedback/page.tsx`, `dashboard/admin/bookings/page.tsx`, `dashboard/organiser/tours/page.tsx`, `dashboard/admin/diary/page.tsx`, `dashboard/organiser/payouts/page.tsx`, `dashboard/messages/page.tsx` |
| **30px** | 8 | `dashboard/venue/[id]/sales/page.tsx`, `dashboard/admin/users/page.tsx`, `dashboard/admin/settings/page.tsx` (main state), `dashboard/admin/revenue/page.tsx`, `dashboard/admin/artists/page.tsx`, `dashboard/organiser/sales/page.tsx`, `dashboard/organiser/events/[id]/sales/page.tsx`, `dashboard/organiser/events/[id]/lineup/page.tsx` |

28px vs 30px is a near-tie (9-8 of 17) - noted as such, not a confident majority either way.

`fontWeight`: 13 of 17 declare `700` explicitly; 3 declare no weight at all (falls through to the browser's default bold `<h1>`, effectively ~700-equivalent); 1 (`dashboard/admin/settings/page.tsx`'s real page heading) explicitly overrides to `900`. Effectively 16 of 17 render at weight ~700 - this split is not close.

**Decided token (12 Sep, post font-migration)**:

| Token | Value | Note |
|---|---|---|
| `--afa-text-page-title` | `28px` / `fontWeight: 700` / `font-family: var(--font-display)` (Young Serif) | Internal dashboard page `<h1>` titles only - not hero/display copy, not the 24px `--afa-text-heading` tier |

**Font-family decision:** migrates to `var(--font-display)` (Young Serif), not Schibsted Grotesk/`var(--font-ui)` and not staying on Georgia. Reviewed against both alternatives via side-by-side mockup before deciding - Georgia's serif warmth was preferred over Grotesk's sans treatment, and Young Serif was chosen over keeping Georgia so these 17 titles tie into the app's one post-migration serif identity (wordmark, hero/editorial content) rather than Georgia remaining the sole holdout from two font generations ago (Newsreader -> Archivo -> Young Serif/Schibsted Grotesk). Same caveat as the rest of the migration: Young Serif ships no italic cut via `next/font/google` - not a blocker today since none of the 17 hits use italic, but worth knowing if that ever changes.

**Size decision:** 28px, resolving the near-tie in favor of the value that already anchors the excluded brand-wordmark and stat-number hits below, rather than 30px which doesn't recur elsewhere in the scale.

**Built (GEN-2609-032, merged to qa in 5bab75e):** 16 hits across 14 files migrated - `admin/settings/page.tsx` (2), `admin/bookings/page.tsx`, `organiser/tours/page.tsx`, `admin/diary/page.tsx`, `organiser/payouts/page.tsx`, `dashboard/messages/page.tsx`, `verify-phone/page.tsx`, `venue/[id]/sales/page.tsx`, `admin/users/page.tsx`, `admin/revenue/page.tsx`, `admin/artists/page.tsx`, `organiser/sales/page.tsx`, `organiser/events/[id]/sales/page.tsx`, `organiser/events/[id]/lineup/page.tsx`. `RatePromptClientPage.tsx`'s hit was already compliant (since `6bb3e24`) - the original Sep-12 audit had misclassified it as still-Georgia. Verified via Contents API against `qa` post-merge (both the changed lines and the excluded same-file lines - `admin/settings` 20px h2s, `tours` 19px h3, `bookings` 24px h1, `artists` 17px stat div - confirmed untouched), Vercel deployment READY, zero runtime errors.

**Excluded from this tier - related but different:**
- **Brand-wordmark instances (2 hits, `RegisterForm.tsx` lines 326 and 378)** - the "AforAudience" logo lockup at the top of the OTP-verification card, also 28px. Not a heading at all (a logo, same register as the site's other wordmark instances) - excluded from `--afa-text-page-title` on purpose, not an oversight.
- **Stat/metric-number hits (3 hits)** - `dashboard/audience/page.tsx` (a KPI stat card's value), `VenueDetailClient.tsx` (venue capacity, and acoustic rating) - both at 28px inside an icon+label stat block, a different UI role than a heading. Flagged as a **possible future fifth tier** (a "stat display" size), not decided, not built.
