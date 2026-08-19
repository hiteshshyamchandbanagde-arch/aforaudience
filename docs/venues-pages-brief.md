# Build brief — Venues directory + detail redesign (GEN-2608-074)

**Read first:** `docs/design.md`, GEN-2608-074 entry (19 Aug) — full rationale, fix-before-port list, and the no-photo-fallback design decision live there. This brief is the mechanical build plan; design.md is the source of truth if anything here is ambiguous.

**Session-start:** `git fetch origin && git reset --hard origin/qa` before branching. Do not branch off a stale local ref.

**Figma Make export:** `C:\Users\hites\AforA\aforaudience\Figma\Redesign Venues Directory Pages` — real source (not just screenshots), Tailwind-based. Use it for structure/spacing/copy reference only — do not port Tailwind classes or the six off-palette hex values verbatim (see Fix-before-port list below).

---

## Scope

Two files get replaced, one gets a new prop threaded through:

1. `src/app/venues/VenuesGridClient.tsx` — directory grid (list is already server-fetched in `page.tsx`, untouched)
2. `src/app/venues/[id]/VenueDetailClient.tsx` — detail page
3. `src/app/venues/[id]/page.tsx` — needs `photos` added to the server→client prop shape (see Real bug #2 below)

New shared components, mirroring the Artist pages' pattern (`ArtistNoPhoto.tsx` / `ArtistIcons.tsx`):

- `src/components/VenueNoPhoto.tsx` — capacity-tier illustrated fallback (three variants: intimate/mid/large)
- `src/components/icons/VenueIcons.tsx` — any new line-art icons needed (search, directions arrow, facility icons)

`VenuesHero.tsx` and `VenuesViewToggle.tsx` get light token-migration passes only (they're already small and mostly token-driven) — not a rebuild.

**Out of scope this round:** the Owners tab's actual data-fetching (`VenueOwnersGridEmbed.tsx`) stays as-is functionally — only give it a visual reskin pass to match the new direction if it's a quick match, don't rebuild its data logic.

---

## Real bugs to fix as part of this build (not cosmetic-only)

1. **Zero mobile breakpoints.** `VenuesGridClient.tsx`'s card grid (`gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"`) and `VenueDetailClient.tsx`'s two-column stat grid (`gridTemplateColumns: "1fr 1fr"`) both currently have no `@media` rules at all. Port the Figma Make export's responsive intent (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` equivalent) as real `@media (max-width: 700px)` scoped `<style>` rules, same convention as the Ledger fix (BUG-2608-070) and the artist featured-card fix (BUG-2608-074) — a `<style>` block in the page component with a class name and a `@media` override, not inline-only styles.
2. **Detail page renders zero photos.** `VenueDetailData` (the interface in `VenueDetailClient.tsx`) doesn't carry `photos` at all. Add `photos: string[]` to the interface, thread it through from `page.tsx`'s server-side Prisma fetch (the field already exists on the `Venue` model — `photos String[]`), and render it using `Photo.tsx`'s existing duotone treatment (same pattern as the artist profile page's photo handling) — falling back to `VenueNoPhoto` when `photos` is empty or every entry is a placeholder (`isPlaceholderImageUrl`, already used elsewhere).

---

## Fix-before-port list (from the Figma Make export — see design.md for full context)

| Found in export | Don't port | Use instead |
|---|---|---|
| `#ff6d4d` hover state on Follow button | new hex | existing `filter: brightness(1.1)` hover convention |
| `#7a5a2e` / `#4a3315` duotone gradient stops | new hex | `Photo.tsx`'s real duotone implementation |
| `#2b2b2b` / `#78766e` / `#b8b6ac` | new hex tokens | opacity-modified `var(--afa-text-primary)` |
| Tailwind utility classes throughout | Tailwind | inline `style={{}}` objects with `var(--afa-*)`, matching every other page |
| Owners tab fixture data (3 hardcoded orgs) | fixture data | real `VenueOwnersGridEmbed` data fetch |

---

## Directory page (`VenuesGridClient.tsx`)

- Hero copy stays as currently translated (`tr.venuesPage.*`) — don't hardcode new English strings over the i18n system.
- Venues/Owners tab toggle: keep existing `VenuesViewToggle.tsx` logic, restyle tab buttons off `--afa-terracotta` onto `--afa-fill-solid`/`--afa-amber`.
- Search input + city `<select>`: token-migrate only (`--afa-ink`/`white` background → real tokens), no structural change needed.
- Card: capacity-tier badge top-left of photo/fallback (`Intimate`/`Mid-size`/`Large`, mono uppercase small label — reuse the existing `--font-mono` label convention already used elsewhere, just not the diamond-separator version), venue name in `--font-display` italic, city + capacity with a plain `·` separator (not the diamond character), price range as a quiet secondary line in amber.
- Real photo → `Photo.tsx` duotone. No real photo / all-placeholder → `VenueNoPhoto` capacity-tier illustration.

## Detail page (`VenueDetailClient.tsx`)

- Follow + Get Directions buttons: Follow solid orange (primary), Get Directions outlined/quiet — real SVG directions-arrow icon, not the current pin-emoji.
- Hero photo gallery (new — see Real bug #2) using `Photo.tsx` duotone, falling back to the capacity-tier `VenueNoPhoto` illustration full-width when no real photo exists — include the honest caption pattern from the mockup ("No verified photos — illustration reflects a [tier] room") when in fallback state.
- Capacity + Acoustic rating stat pair: keep the existing "Not rated yet" placeholder logic untouched (`acousticRating: null`) — do not invent a fake rating.
- Facilities: redesign from pill-chips to icon+label rows (2-column on desktop, 1-column on mobile) — reuse or extend `VenueIcons.tsx` for facility icons (Parking, Green Room, Wheelchair Access, etc. — check `Venue.facilities` for the actual free-text values in use before assuming a fixed icon set; fall back to a generic checkmark/tag icon for unrecognized facility strings).
- Seating & pricing table: keep the existing `sections` rendering logic (name/seats/price), just token-migrate the visual treatment — this is functionally fine today, only the styling is dated.

---

## Verification checklist before opening a PR

- [ ] `tsc` clean against the known baseline (currently ~79 pre-existing errors — compare, don't just count)
- [ ] Live-verify both pages at a phone-width viewport (375-440px) — confirm the grid/stat-pair breakpoints actually stack, not just that the `@media` rule exists in the CSS
- [ ] Confirm zero off-palette hex colors anywhere in the two touched files
- [ ] Confirm zero emoji
- [ ] Confirm the detail page actually renders a photo for at least one venue with real (non-placeholder) `photos` data in QA, and the capacity-tier fallback for one without
