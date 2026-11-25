# Venue Owner Portal — Figma Make Export Audit

Verified from raw source (`Review_prompt_details.zip`, extracted at `C:\Users\hites\AforA\aforaudience\Figma\Review prompt details`), not from the tool's self-reported state or rendered preview — per this project's established discipline (Figma Make has misreported "done" before).

## Export structure

```
src/App.tsx            — sidebar nav + screen router (6 screens, client-side state)
src/screens.tsx         — all 6 screen components
src/components/ui.tsx   — shared Card, Button, Pill, EmptyState, icon set
src/data.ts             — mock data
src/index.css           — Tailwind v4 @theme tokens
```

## Verified against `docs/venue-owner-portal-design-brief.md` §"Design system to follow"

| Spec | Export | Result |
|---|---|---|
| `#141414` bg / `#1F1F1F` panel / `#0A0A0A` band | `--color-bg`/`--color-panel`/`--color-band`, exact | ✅ |
| `#F5F5F0` ink, 65%/40% opacity secondary/muted | `--color-ink`/`--color-ink-2`/`--color-ink-3`, exact | ✅ |
| `#C9973A` accent, `#FF5A36` CTA | `--color-accent`/`--color-cta`, exact | ✅ |
| Newsreader / Manrope / IBM Plex Mono, 3-tier use | `--font-display`/`--font-body`/`--font-mono`, correctly scoped (display = headings only, mono = stats/labels/pills) | ✅ |
| Card radius 12px (NOT the public sharp-corner system) | `Card` component (`ui.tsx:171`) hardcoded `rounded-[12px]` | ✅ |
| No stale `--afa-terracotta` | grepped clean across `src/` | ✅ |
| Status pill color coding (gold/pending, green/approved, red/cancelled, gray/completed, ~13% opacity tint bg) | `toneMap` in `ui.tsx:119-124`, matches exactly | ✅ |
| Empty states: crosshatch texture + amber line-art + mono caption | `.crosshatch` class + `EmptyState` component, used on Your Venues (zero-venue case) and Flexible (zero-request case) | ✅ |
| All 6 screens present and separated per corrected brief mapping | `YourVenues`, `EditProfile`, `Revenue`, `Bookings`, `Flexible`, `Register` — Flexible correctly built as its own screen, not merged into Bookings | ✅ |

## Deviations found

1. **Secondary UI elements use 8px radius, not 12px.** Nav buttons, toggle groups, the map-icon button on `VenueCard` use Tailwind's default `rounded-lg` (8px) rather than the card's explicit `rounded-[12px]`. Minor, visually subtle, not worth a re-generation round. **Decision: port as-is, don't chase pixel-parity on secondary elements the brief didn't specify a radius for.**

## Porting plan

Same pattern as the Organisers rebuild: read the export directly (no guessing from memory of what Figma Make "usually" produces), map each screen to its real route, reuse existing shared app components where they already exist rather than reimplementing from the export's own `ui.tsx`.

| Export screen | Real app route | Notes |
|---|---|---|
| `YourVenues` | `src/app/dashboard/venue/page.tsx` | Existing page fetches real venue data — port styling/layout, not the mock data shape |
| `EditProfile` | `src/app/dashboard/venue/edit/page.tsx` | |
| `Revenue` | `src/app/dashboard/venue/sales/page.tsx` | |
| `Bookings` | `src/app/dashboard/venue/bookings/page.tsx` | Calendar + list view |
| `Flexible` | `src/app/dashboard/venue-requests/page.tsx` | Separate top-level route, confirmed in prior session |
| `Register` | `src/app/dashboard/venue/create/page.tsx` | |

**Reuse, don't reimplement:**
- Status badge pattern: check `dashboard/organiser/page.tsx`'s existing `STATUS_STYLE` lookup before deciding whether to introduce the export's `Pill`/`toneMap` as a new shared component or align to what's already there — avoid two parallel badge systems in the same `dashboard/` tree.
- `Photo`/avatar handling: if any screen touches venue images, use the existing shared `Photo` component (with its duotone/placeholder-guard logic), not new `<img>` tags from the export.
- Form input chrome: check existing dashboard or public-site form components before inventing new field styling from the export's raw form markup.

**Not part of this pass:** any new functionality, data fields, or interaction changes — this is a visual/styling port onto working screens only.
