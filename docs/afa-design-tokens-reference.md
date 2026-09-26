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

--afa-fill-solid:      #FF5A36;   /* bright accent for solid CTA fills (Phase 2c) */
--afa-on-fill-solid:   var(--afa-brown-black);  /* text color on top of fill-solid */

--afa-text-primary:    #F5F5F0;
--afa-text-secondary:  rgba(245, 245, 240, 0.65);
--afa-text-muted:      rgba(245, 245, 240, 0.4);
--afa-text-inverse:    #F5F5F0;  /* pre-existing gap, fixed by GEN-2609-075 — defined in globals.css since before GEN-2609-074, 3 real consumers (src/app/page.tsx, for-artists/page.tsx, FourRooms.tsx), just never had a row in this table. Not caused by -074, which only added its own -on-image row correctly. */

--afa-text-on-image:   rgba(255, 255, 255, 0.5);  /* GEN-2609-074 — hero-subtitle text over a PHOTOGRAPH, not a flat surface; a cooler/purer white than --afa-text-secondary's warm cream tint, tuned for legibility across a photo's unpredictable luminance rather than reused for token-count tidiness */
```

**GEN-2609-075 — radius + button-padding scale (new tokens, admin-controlled).** Promoted out of `Button.tsx`'s `SIZE_CHROME`/per-variant `borderRadius`, where these were previously plain hardcoded numbers, never a CSS custom property:

```css
--afa-radius-sharp:    0px;    /* cards, sharp-corner house convention (Section 3) */
--afa-radius-sm:       6px;    /* Button sm size tier, outline-neutral */
--afa-radius-md:       8px;    /* Button md/lg size tier, form-submit */
--afa-radius-pill:     999px;  /* primary, outline, toggle-pill, pill-sm/pill-md */

/* GEN-2609-112 (26 Sep) - radius closeout, full 8-step scale */
--afa-radius-xs:       3px;    /* new - absorbs 2/3/4px (EventCard's 3px signature, small chips) */
--afa-radius-lg:       12px;   /* renamed from --afa-radius-12px; absorbs 10/12/14px (dashboard cards) */
--afa-radius-xl:       16px;   /* new - auth cards, sheets, modals */
--afa-radius-2xl:      20px;   /* new - absorbs 20/24px (bottom-sheet tops) */

--afa-btn-padding-sm:  4px 10px;
--afa-btn-padding-md:  9px 17px;
--afa-btn-padding-lg:  12px 24px;
```

**GEN-2609-081 — scale extension (new tokens, admin-controlled, no migration).** `GEN-2609-079`'s bulk migration found these 14 values recurring 50+ times repo-wide (precise, reconciled count — see `docs/design.md`'s `GEN-2609-081` entry for the full per-value table) with no existing scale step to match exactly. Explicit px-suffixed names, not step indices/role names — see that same entry for why. Zero adoption yet (no page file was migrated to reference them in this ticket) — same "tokens only" posture Section 8's own original scale had before `GEN-2609-077`'s homepage phase:

```css
--afa-space-2px:   2px;
--afa-space-6px:   6px;
--afa-space-10px:  10px;
--afa-space-14px:  14px;
--afa-space-18px:  18px;
--afa-space-28px:  28px;
--afa-space-32px:  32px;
--afa-space-48px:  48px;

/* renamed 25 Sep (GEN-2609-106, #702) from --afa-text-10px/15px/18px/20px */
--afa-text-caption:    10px;
--afa-text-body-lg:    15px;
--afa-text-lead:       18px;
--afa-text-subtitle:   20px;
--afa-text-subheading: 22px;  /* new, GEN-2609-106 */

/* --afa-radius-10px / --afa-radius-12px: removed 26 Sep (GEN-2609-112) -
   10px retired into --afa-radius-lg (10 -> 12px), 12px renamed to lg. */
```

**GEN-2609-099 — general-purpose translucent tints (new tokens, wired on adoption).** The 2 `rgba(245,245,240,*)` alpha values (of `--afa-text-primary`'s own base RGB) that clear `GEN-2609-081`'s 50-occurrence bar — see `docs/design.md`'s `GEN-2609-099` entry for the full occurrence count and the naming rationale (checked real property context: both are border-dominant but genuinely mixed with background usage, not a single role, hence `--afa-tint-*` rather than `--afa-border-*`/`--afa-text-*`). Unlike `GEN-2609-081`'s tokens, these had real, immediate adoption in the same PR that defined them (49 literal sites across 31 files) — not "tokens only":

```css
--afa-tint-08: rgba(245, 245, 240, 0.08);
--afa-tint-10: rgba(245, 245, 240, 0.1);
```

**Admin-controlled runtime layer (GEN-2609-075, 19 Sep).** Every token in this section, plus `--font-display`/`--font-ui`/`--font-sans`/`--font-mono`, is now also a row in the `DesignToken` table (`aforaudience-qa`) and editable at `/dashboard/admin/design-system` — an admin change is cached (tag `"design-tokens"`) and takes effect on the next page load, no deploy, falling back to the static values in this file/`globals.css` if the DB is empty or unreachable. `globals.css` stays the authoritative *default* (and the only thing that matters for a fresh environment before the table is seeded); the DB is a runtime override layer on top of it, not a replacement. 5 tokens (`--afa-surface-page`, `--afa-surface-raised`, `--afa-amber`, `--afa-fill-solid`, `--afa-on-fill-solid`) are "locked" in the admin UI — still editable, gated behind a confirm dialog — unrelated to this section's own CI-enforced locked-palette rule below, which keeps blocking raw literals in application *code* regardless of what the DB holds. Full reasoning in `docs/design.md`'s `GEN-2609-075` entry.

**Do not confuse this 5 with the 5 `--afa-text-*` tokens two paragraphs up (`primary`/`secondary`/`muted`/`inverse`/`on-image`) — GEN-2609-076 found the two genuinely conflated once already.** Zero overlap between the two sets; they answer different questions (which named color a piece of text should use, vs. which tokens are core-identity-defining enough to need a confirm click before an admin changes them). Locking the text-role tokens behind a confirm dialog wouldn't make sense — they're ordinary content-color choices, not brand-identity primitives — so `GEN-2609-076` recommended keeping the surface/amber/fill-solid set as-is rather than reconciling toward this section's `--afa-text-*` table.

**Borders**: there is no single `--afa-border` token. In practice, borders are hand-authored `rgba(245,245,240, α)` (translucent cream-on-dark) at low opacity for resting state, with `--afa-amber` (or `rgba(201,151,58, α)`) on hover/focus:

- Card resting border: `1px solid rgba(245,245,240,0.1)` ([VenuesGridClient.tsx:94](../src/app/venues/VenuesGridClient.tsx#L94))
- Card hover border: `rgba(201,151,58,0.6)` (amber, same rule)
- Button border: `1.5px solid rgba(201,151,58,0.5)` (Get Directions) or `1.5px solid var(--afa-fill-solid)` (Follow, when active)
- Divider rule (footer of event card): `1px solid rgba(245,245,240,0.1)`

**Enforcement (GEN-2609-052, 13 Sep):** the locked-palette rule above is now checked in CI, not just documented. `scripts/check-design-tokens.js` (run from `.github/workflows/design-tokens.yml` on every PR into `qa`/`main`) fails the build on any *added or changed* line in `src/**/*.ts(x)` containing a raw hex literal, a raw `rgb()`/`rgba()` literal, or a hardcoded `font-family` not using `var(--font-*)`. It's diff-only against the PR's base branch — the hand-authored border `rgba()` values documented just above are pre-existing and untouched by this check, but a *new* hand-authored border literal added from here on will now fail CI; route new border colors through a `--afa-*` token (or `var(--afa-amber)` / `rgba(201,151,58, α)` reference, not a fresh literal) instead. Exempt: `globals.css` itself, `src/lib/statusStyle.ts` (the tone source-of-truth), `src/app/api/posters/**` (Section 8.1's non-UI exception), and test files. See `docs/design.md`'s GEN-2609-052 entry for the full rationale and verification.

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

**GEN-2609-053 audit: no shared `Card` base extracted, deliberately.** "VenueCard" isn't actually its own component today — it's inline JSX in [VenuesGridClient.tsx](../src/app/venues/VenuesGridClient.tsx#L188), styled via the `.afa-venue-card` class. [EventCard.tsx](../src/components/EventCard.tsx#L216) is a real, separate, reusable component. Compared their actual chrome (not assumed) before deciding whether to merge:

| | Venue card | EventCard |
|---|---|---|
| Corner radius | `0` (sharp, house convention above) | `3px` (own export's signature, already noted above) |
| Hover treatment | `.hover-lift-card` translateY + shadow + amber border/title-color transition | none |
| Dimming mechanism | `navigatingId` state shared across the whole grid — every OTHER card dims while one navigates | `disabled` prop passed to each card individually |
| Layout modes | one (grid only) | two (`view: "grid" \| "list"`, different flex direction/padding) |

Every one of these is a real, already-documented difference (the radius split is called out two lines above; `EventCard`'s own header comment says it was independently verified against a different Figma export, "not assumed to share Venues' zero-radius sharp-corner rule"), not incidental drift. The only literally-identical piece across the two (plus `EventRow`) is the `isNavigating` spinner overlay markup (`position:absolute, inset:0, z-index:2, dark scrim + spinning ring`) — repeated 3x byte-for-byte at 24-26px. Flagged as a real, narrow extraction candidate for a future pass; not built here, since forcing the two cards' outer shells into one parameterized component would mean re-exposing every one of the four differences above as a prop, which is indirection, not consolidation.

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

**Shared component (GEN-2609-053):** [src/components/ui/Button.tsx](../src/components/ui/Button.tsx) is the real, importable version of the roles above — `variant="primary" | "secondary" | "secondary-reveal" | "close" | "outline" | "form-submit"`. Renders a `<button>`, or a `<Link>` when given an `href`. Added `form-submit` this pass: a distinct full-width, 8px-radius solid-fill role (`login`/`register`'s form submit buttons) found byte-identical across 8 call sites in 4 files — a real, repeated pattern, not `primary`'s pill shape re-derived, same discipline as the `outline` variant added in GEN-2609-047. Migrated `login/page.tsx` (3 buttons) and `RegisterForm.tsx` (2 buttons) this pass; `forgot-password/page.tsx:91` and `reset-password/page.tsx:131` have the identical shape but weren't touched (lower-traffic recovery flows, follow-up scope). A second strong candidate found but **not** built this pass — do not invent a second variant in the same sweep: 11 occurrences across 9 dashboard/organiser files (e.g. [dashboard/organiser/edit/page.tsx:174](../src/app/dashboard/organiser/edit/page.tsx#L174), [dashboard/organiser/tours/page.tsx:78,96](../src/app/dashboard/organiser/tours/page.tsx#L78)) share one exact `background: var(--afa-terracotta); borderRadius: 8px; fontSize 14px; fontWeight 600` solid-action chrome — the next Button pass's highest-confidence match.

## 5. Status badge / pill pattern

**Shared component (GEN-2609-053):** [src/components/ui/Badge.tsx](../src/components/ui/Badge.tsx) renders the tone values below — `<Badge tone={...}>{label}</Badge>`. Tone values (`bg`/`color`) come from [src/lib/statusStyle.ts](../src/lib/statusStyle.ts)'s `STATUS_TONE` (GEN-2609-051) and stay domain-specific per caller; only the pill chrome is shared, and it's genuinely **not** one chrome — audited before assuming so, per the pattern below.

Live in the **Organiser dashboard** ([dashboard/organiser/page.tsx:27-32](../src/app/dashboard/organiser/page.tsx#L27)) — a `STATUS_STYLE` lookup keyed by backend status, each with its own `bg`/`color`/`label`:

```js
DRAFT:            { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)',        label: 'Draft' }
APPROVED:         { bg: 'rgba(74,103,65,0.12)',  color: 'var(--afa-sage)',        label: 'Published' }
PENDING_APPROVAL: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)',        label: 'Pending' }
CANCELLED:        { bg: 'rgba(179,38,30,0.1)',   color: 'var(--afa-error)',       label: 'Cancelled' }
COMPLETED:        { bg: 'rgba(245,245,240,0.08)',color: 'var(--afa-text-primary)',label: 'Completed' }
```
`<Badge variant="status">` chrome (the default — dashboard/organiser's shape):
```css
font-size: 11px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 5px 10px;
border-radius: 999px;   /* NOTE: fully rounded pill — dashboard badges are NOT under the sharp-corner card rule */
white-space: nowrap;
```
`<Badge variant="status-compact">` chrome (`tickets/page.tsx`'s shape — **not** the same as the above, confirmed by diffing the two files' actual JSX rather than assumed): no `text-transform`/`letter-spacing`, `padding: 4px 10px` instead of `5px 10px`. Migrated this pass: `tickets/page.tsx`'s booking-status pill, its "attended"/"missed" pill (previously re-typing `STATUS_TONE.sage`/`.muted`'s literal rgba values inline instead of importing them), and its companion "confirmed" pill (same sage tone, hardcoded a third time) — three separate inline duplicates in one file, all now `<Badge variant="status-compact">`.

The visible "PUBLISHED" label in data (venue `status` field, per `docs/design.md`'s incident notes) maps to this same badge family — the dashboard's `APPROVED` → `"Published"` row is the shipped analog; there's no separate literal `PUBLISHED`-labeled badge component.

**Not migrated this pass:** the many other `borderRadius: '999px'` pill `<span>`s elsewhere (admin feedback/bookings/diary pages, artist events/applications, organiser tours/lineup) each carry their own one-off tone map (e.g. `dashboard/artist/page.tsx`'s `APPLICATION_STYLE`) — real duplication of the same pattern, already flagged out of scope by GEN-2609-051's own header comment in `statusStyle.ts`, still out of scope here.

## 5.1 Status tone system (GEN-2609-067 — the actual governed palette)

Section 1's "core tokens" list undersells what's real and load-bearing: `STATUS_TONE` in [src/lib/statusStyle.ts](../src/lib/statusStyle.ts) is a second, equally-governed palette — 5 tones, each a `{ bg, color }` pair — that every status-badge site in the app is meant to draw from, rather than hand-typing its own `rgba()`/hex pair per status. It's exempt from `check-design-tokens.js`'s literal-check for exactly this reason (Section 1 above already lists it among the exemptions) — this is where new tone literals are *supposed* to live, not a gap in the checker.

```js
gold:   { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)' }         // pending / draft / awaiting-action
sage:   { bg: 'rgba(74,103,65,0.12)',  color: 'var(--afa-sage)' }         // approved / published / confirmed / accepted
error:  { bg: 'rgba(179,38,30,0.1)',   color: 'var(--afa-error)' }        // cancelled / declined / failed
muted:  { bg: 'rgba(245,245,240,0.08)',color: 'var(--afa-text-primary)' }// completed / neutral end-state
orange: { bg: 'rgba(255,90,54,0.1)',   color: 'var(--afa-fill-solid)' }   // declined-with-emphasis (fill-solid hue, not error's red)
```

**Scoping rule, stated explicitly in the file's own header comment (GEN-2609-051):** each page owns its own `status → tone` mapping, keyed by that page's real domain statuses (a booking's lifecycle ≠ an event's — there's no `CONFIRMED` event status, no `DRAFT` booking status). What's shared is the *tone*, not a single cross-domain status table. Don't build a unified `STATUS_TONE.CANCELLED`-style export that tries to cover every domain's statuses at once — that would force domains that don't actually correspond into a false shared shape. `dashboard/organiser/page.tsx`'s `STATUS_STYLE` (event statuses) and `tickets/page.tsx`'s booking-status map are the two real, currently-scoped consumers; several other status-badge objects elsewhere (`dashboard/artist/page.tsx`'s `APPLICATION_STYLE`, `dashboard/organiser/tours/page.tsx`, etc.) reuse the same 5 tones but aren't migrated onto this table yet — real duplication, already flagged out of scope by the file's own header, not an oversight.

**`Badge` component variants** ([src/components/ui/Badge.tsx](../src/components/ui/Badge.tsx), GEN-2609-053/-060) — render a tone via `<Badge variant="..." tone={STATUS_TONE.x}>{label}</Badge>`. The component owns only pill *chrome* (font-size/padding/radius); tone stays the caller's own domain-scoped value per the rule above. 5 variants exist because the real shipped chrome genuinely differs by call site — audited before assuming any two matched, not merged on a guess:

| Variant | Chrome | Real call sites |
|---|---|---|
| `status` (default) | `11px` / `700` / uppercase / `0.05em` letter-spacing / `5px 10px` padding / `999px` radius | `dashboard/organiser/page.tsx` event-status pills |
| `status-compact` | `11px` / `700` / no uppercase / `4px 10px` padding / `999px` radius | `tickets/page.tsx` booking-status, attended/missed, confirmed pills |
| `micro` | `10px` / `700` / `2px 8px` padding / `999px` radius | `admin/feedback` category/severity badges |
| `tag` | `11px` / `500` / `2px 8px` padding / `999px` radius | `admin/bookings`'s "FREE" tag — a fixed fact, not a lifecycle state |
| `pill` | `13px` / `700` / `5px 12px` padding / `999px` radius | `artist/events`' compensation pill, "Lineup full" pill |

**Related, but deliberately not part of `STATUS_TONE`:** `FILL_SOLID_TINT` (`rgba(255,90,54,0.08)`) and `FILL_SOLID_BORDER_TINT` (`rgba(255,90,54,0.25)`), plus the `fillSolidTint(alpha)` helper, live in the same file (GEN-2609-063/-066) but aren't a 6th tone — they're the translucent-selected-state companion to `--afa-fill-solid`, which (unlike `--afa-error`/`--afa-gold`/`--afa-sage`) has no CSS-level "-tint" variable of its own.

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

**Scale extended 19 Sep (`GEN-2609-081`).** The 6-step type scale / 6-step spacing grid / 4-step radius scale below are the *original* scale — 14 more px-suffixed tokens (`--afa-space-2px`/`6px`/`10px`/`14px`/`18px`/`28px`/`32px`/`48px`, `--afa-text-10px`/`15px`/`18px`/`20px`, `--afa-radius-10px`/`12px`) were added in Section 1 above to cover the highest-frequency off-scale values `GEN-2609-079`'s migration actually found in shipped code (50+ repo-wide occurrences each) — see `docs/design.md`'s `GEN-2609-081` entry for the full measurement.

**Tokens exist, adoption doesn't (as of 15 Sep, Step 1 completion).** All 14 tokens below — the 6-step type scale, the 6-step spacing grid, and both page-title tiers — are now real CSS custom properties in `src/app/globals.css`. Nothing in the app consumes them yet: the ~36 existing page-title call sites are still literals, and no component has been retrofitted to the base scale/grid either. Derived from grepping every shipped `font-size`/`fontSize` and `padding`/`margin`/`gap` value in `src/`, not assumed. Source: `docs/afa-uiux-design-audit.md`, qa @ `4456f3b`.

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

**Built (GEN-2609-033, merged to qa in e74699a):** follow-up sweep found 4 real hits Section 8.4's original audit missed - 2 had no `fontFamily` at all (`my-feedback/page.tsx:324`, miscounted as Georgia), 2 sat outside the 28-30px window (`dashboard/audience/page.tsx:106`, a 32px `<h1>` never audited; and its 30px stat value at line 40). Resolved via the migration's existing context rule rather than a new tier: `my-feedback` and both `audience/page.tsx` hits (personal-account content) -> `var(--font-display)`; `admin/artists/page.tsx:344`'s stat value (internal Admin-tool content) -> `var(--font-ui)`. `VenueDetailClient.tsx`'s previously-flagged hits turned out already compliant (auto-inherited `var(--font-display)` from the original token repoint, never needed touching) - the stat/metric-number bullet below is now stale on that point. Verified via Contents API, Vercel READY, zero runtime errors.

**Excluded from this tier - related but different:**
- **Brand-wordmark instances (2 hits, `RegisterForm.tsx` lines 326 and 378)** - the "AforAudience" logo lockup at the top of the OTP-verification card, also 28px. Not a heading at all (a logo, same register as the site's other wordmark instances) - excluded from `--afa-text-page-title` on purpose, not an oversight.
- ~~Stat/metric-number hits (3 hits) - dashboard/audience/page.tsx, VenueDetailClient.tsx~~ **Resolved, see GEN-2609-033 above.** No 5th tier was needed - `dashboard/audience/page.tsx`'s stat value and `admin/artists/page.tsx`'s stat value each fit cleanly into the existing two tokens once classified by context (personal-account vs admin-tool), same as everything else in the migration. `VenueDetailClient.tsx` was never actually broken.

### 8.5 Page-title-lg tier (discovered 12 Sep, second-wave sweep beyond 8.4's 28-30px scope)

A full-repo Georgia sweep post-GEN-2609-032/033 found 97 remaining hits across 39 files. Most (71) were confirmed legitimately excluded - h2/h3 section headings (`admin/settings` 20px h2s, `AuthPromptSheet.tsx`/`CorporateInquiryModal.tsx` 20px h2s, `profile/page.tsx`'s 8 section h2s at 18px, etc.), one-off labels (`DashboardShell.tsx`'s "My Roles" span), and the decorative `layout.tsx` intro-splash tagline - none of these are page titles and none were touched. The remaining 27 were genuine `<h1>` page titles across 4 size clusters that predate any font audit:

| Value | Count | Treatment |
|---|---|---|
| **32px** | 12 | New token, `--afa-text-page-title-lg`: `32px` / `fontWeight: 700` / `font-family: var(--font-display)`. Top-level "your own account" pages with no `BackLink` - `profile`, `tickets`, `organiser`/`artist`/`venue` edit and dashboard-home pages, event create/edit |
| **28px** | 5 | Folded into the existing `--afa-text-page-title` (28px) - all 5 render states of `checkout/[bookingId]/page.tsx` |
| **26px** | 4 | Folded into `--afa-text-page-title`, resized 26px → 28px - `admin/page.tsx` ("Command Center") plus 3 nested pages with a `BackLink` (`organiser/events/[id]/checkin`, `organiser/tours/[id]`, `organiser/tours/create`), same structural pattern as the existing tier |
| **24px** | 6 | Font-family fix only, already matches `--afa-text-heading` (24px) - empty/unregistered-state headings (`organiser`/`venue` "not registered" states) and secondary dashboard headers (`admin/feedback`, `admin/bookings`) |

**Deferred, not part of this pass:** 3 one-off `<h1>` sizes with too small a sample to warrant a tier call - `messages/[id]/page.tsx` (22px), `(public)/tours/[slug]/page.tsx` (34px), `ComingSoon.tsx` (36px).

**Built (GEN-2609-035, merged to qa in 5b6c2b4):** all 27 hits across 20 files migrated exactly per the table above. Verified via diff review (every change touches only `fontFamily`, cluster 3 also `fontSize`), `tsc --noEmit` clean, live-render via real QA logins across organiser/artist/venue/audience personas (admin pages verified via diff+grep+tsc only - admin auth is real Google OAuth, not a scriptable QA credential). Contents API confirmed the do-not-touch items (`checkout`'s 20px event-title div, `profile`'s h2 section headers) remained untouched. Vercel READY, zero runtime errors.
