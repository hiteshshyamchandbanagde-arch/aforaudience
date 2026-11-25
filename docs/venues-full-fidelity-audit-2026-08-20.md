# Full fidelity audit — Venues pages (directory + detail) vs. Figma Make export
**Date:** 20 Aug 2026. **HEAD at start:** `4455740` (origin/qa).

This is a fresh, element-by-element pass against the real export
(`Figma\Redesign Venues Directory Pages\src\pages\VenuesDirectory.tsx`,
`VenueDetail.tsx`, `src\components\VenueCard.tsx`, `VenueMedia.tsx`,
`icons.tsx`, `index.css`), following BUG-2608-072 through -076. Every item
in the earlier briefs was re-checked, not trusted — the items below are
**new**, not already covered by 072-076. Three items (Photo.tsx duotone
treatment, the SiteNav generic back-link, the Owners-card breakpoint
strategy) were re-verified and found correct/acceptable; they are listed
at the bottom under "Re-checked, no action" rather than silently skipped.

---

## Gap 1 — Directory hero H1: font-size roughly half the spec, wrong weights

Export (`VenuesDirectory.tsx` line 26-28):
```
<h1 className="mt-5 max-w-3xl font-display text-[clamp(2.75rem,7vw,5rem)] font-medium leading-[0.95] tracking-[-0.02em] text-cream">
  Where the <em className="font-normal italic text-amber">show</em> happens.
</h1>
```
`clamp(2.75rem,7vw,5rem)` = **44px → 80px**. `font-medium` = weight **500**. The emphasis word is `font-normal` = weight **400**.

Live (`VenuesHero.tsx` line 26-29):
```tsx
<h1 style={{ marginTop: "16px", fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.6vw, 40px)", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 0.95, color: "var(--afa-text-primary)" }}>
  {tr.venuesPage.headingPrefix}
  <em style={{ color: "var(--afa-amber)", fontStyle: "italic", fontWeight: 500 }}>{tr.venuesPage.headingEmphasis}</em>
```
Renders **28px → 40px** (half the export's max size), weight **700** (should be 500), emphasis word weight **500** (should be 400).

This isn't a one-off: every comparable hero H1 elsewhere in the codebase confirms 40px-max is the outlier, not the convention — `Hero.tsx` uses `clamp(40px, 8vw, 104px)` @ weight 500, `ArtistHero.tsx` uses `clamp(28px, 4.4vw, 54px)` @ weight 500, the Artists directory H1 uses `clamp(28px, 4vw, 48px)`. Venues' own hero is both undersized relative to its own export spec *and* relative to every sibling page's established scale.

## Gap 2 — Directory hero: block spacing tightened ~20% across the board

Export: header `pb-10` (40px); h1 `mt-5` (20px) below eyebrow; p `mt-5` (20px) below h1; toggle row `mt-10` (40px) below the header's bottom border.

Live: header `paddingBottom: 32px`; h1 `marginTop: 16px`; p `marginTop: 16px`; header→toggle gap is header's own `marginBottom: 32px` (toggle adds no top margin of its own).

Every value is 80% of the export's — 32/40, 16/20, 16/20, 32/40. Small individually, compounds into a visibly denser hero block than the export.

## Gap 3 — Detail page title: italic when it shouldn't be, fixed 32px instead of responsive, wrong weight

Export (`VenueDetail.tsx` line 32-34):
```
<h1 className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,6vw,4.5rem)] font-medium leading-[0.95] tracking-[-0.02em] text-cream">
  {venue.name}
</h1>
```
Not italic anywhere — only the directory hero's "show" word is. `font-medium` = 500. `clamp(2.5rem,6vw,4.5rem)` = **40px → 72px**.

Live (`VenueDetailClient.tsx` line 107-109):
```tsx
<h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "32px", fontWeight: 700, color: "var(--afa-cream)", marginTop: "10px", marginBottom: "6px" }}>
  {venue.name}
</h1>
```
Venue name headline renders **italic** (export doesn't), **fixed 32px** (should be a responsive 40-72px), weight **700** (should be 500). This materially changes the page's visual hierarchy — the venue name should be the loudest thing on the page and currently reads smaller/stylized instead of large and upright.

Also: eyebrow→h1 spacing is export's `mt-4` (16px) vs live `marginTop: 10px`. Address paragraph: export constrains it to `max-w-md` (448px) at `text-[1.05rem]` (~16.8px) `leading-snug`; live has no max-width and renders at `fontSize: "14px"`.

## Gap 4 — Detail page section headings undersized

Export (`VenueDetail.tsx` line 98, 130): both "Seating & pricing" and "Facilities" use `text-2xl` = **24px**.

Live (`VenueDetailClient.tsx` line 150, 183): both render at `fontSize: "20px"`.

## Gap 5 — Card tier badge only shows on no-photo fallback cards, not real-photo cards

Export (`VenueCard.tsx` line 13-22) — the tier badge is a sibling overlay on the card's media wrapper, present regardless of which branch renders inside it:
```tsx
<div className="relative aspect-[4/3] w-full overflow-hidden border border-ink-600 ...">
  {venue.hasRealPhoto ? <PhotoSlot seed={venue.id} /> : <VenueFallback capacity={venue.capacity} seed={venue.id} />}
  <span className="eyebrow absolute left-3 top-3 text-cream/55">{tierLabel(venue.capacity)}</span>
  <span className="absolute right-3 top-3 ...">...</span>
</div>
```

Live (`VenuesGridClient.tsx` line 179-206) only has two branches — `<Photo>` (real) or `<VenueNoPhoto>` (fallback) — and the tier-label span lives *inside* `VenueNoPhoto` itself (`VenueNoPhoto.tsx` line 55-57), not as a card-level overlay. Any card with a real photo never renders a tier badge at all.

## Gap 6 — Sharp-corner rule still violated in three places

Established explicitly as a hard rule in BUG-2608-072 (gaps 4 & 7) and BUG-2608-073 (gap 3) — "no rounded corners anywhere... real aesthetic signature of this direction." Still present:

- `VenuesGridClient.tsx` line 102: search-box wrapper `borderRadius: "8px"`.
- `VenuesGridClient.tsx` line 116: city `<select>` `borderRadius: "8px"`.
- `VenueOwnersGridEmbed.tsx` line 87: owners-tab search input `borderRadius: "8px"`.

(Loading-spinner circles and the notify-bell toggle's `borderRadius: 50%` are legitimately circular UI, not part of this rule — left alone.)

## Gap 7 — City filter is a native `<select>`, not the export's custom listbox

Export (`VenuesDirectory.tsx` line 68-96) is a fully custom button + absolutely-positioned listbox: chevron icon that rotates on open, `hover:border-amber/40` on the trigger, per-option `hover:bg-ink-700` and an amber active-item color.

Live (`VenuesGridClient.tsx` line 113-122) is a bare native `<select>` — no chevron, no custom hover/active states, browser-default rendering for the option list, and (per Gap 6) still rounded.

## Gap 8 — Search box doesn't flex to fill the row

Export: search `<label>` is `flex-1` next to a fixed `sm:w-64` (256px) city control — the search box grows to fill whatever space remains.

Live (`VenuesGridClient.tsx` line 102): search box wrapper is hard-capped at `maxWidth: "360px"` regardless of viewport width, leaving unused space next to the city filter on wider screens instead of growing into it.

## Gap 9 — Directory `<main>` background collides with the card fill token

`page.tsx` line 95: `<main style={{ ..., background: 'var(--afa-surface-raised)', ...}}>`. `VenuesGridClient.tsx` line 146: card `background: "var(--afa-surface-raised)"`. **Same token, same hex (`#1F1F1F`), on both the page and the card sitting on top of it** — cards have zero background separation from the page and read as border-only outlines with no elevation.

This is also inconsistent with the detail page, which correctly uses `--afa-surface-page` (`VenueDetailClient.tsx` line 80). Per `globals.css` line 144-149's own token-intent comment, `--afa-surface-raised` is reserved for "elevated panel" content, explicitly not the base page — the directory page's `<main>` should use `--afa-surface-page`, matching the detail page and freeing `--afa-surface-raised` to actually read as elevated on the cards.

## Gap 10 — Detail-page gallery only ever shows one photo

Export (`VenueDetail.tsx` line 67-78) is a real multi-photo grid when the venue has real photos: one large photo (`col-span-2 row-span-2`) plus up to 4 additional square thumbnails, `grid-cols-2` on mobile / `md:grid-cols-4 md:grid-rows-2` on desktop.

Live (`VenueDetailClient.tsx` line 64, 132-138):
```tsx
const realPhoto = venue.photos?.find((p) => !isPlaceholderImageUrl(p)) || null
...
{realPhoto ? <Photo src={realPhoto} alt={venue.name} /> : <VenueNoPhoto ... />}
```
Only the *first* non-placeholder photo is ever used, in a single 16:9 box — even when `venue.photos` holds several real images, the rest are silently dropped.

## Gap 11 — Inactive view-toggle tab has no hover state

Export (`VenuesDirectory.tsx` line 42): `tab === t ? "text-cream" : "text-cream-faint hover:text-cream-dim"` — the inactive tab brightens on hover.

Live (`VenuesViewToggle.tsx` line 49-61) sets `color` via inline style with no accompanying `:hover` rule anywhere — same "inline style beats `:hover`" bug class already fixed twice in this codebase (BUG-2608-072 gap 4, BUG-2608-073 gap 4). The inactive tab is dead to hover entirely.

## Gap 12 — Seating & Pricing table has no header row, seat counts unformatted

Export (`VenueDetail.tsx` line 101-108) has a real `<thead>`:
```tsx
<thead>
  <tr className="eyebrow text-cream-faint">
    <th className="py-3 text-left font-normal">Section</th>
    <th className="py-3 text-right font-normal">Seats</th>
    <th className="py-3 text-right font-normal">Price</th>
  </tr>
</thead>
```
and formats seat counts with `s.seats.toLocaleString("en-IN")` / `tabular-nums`, same as the Price column.

Live (`VenueDetailClient.tsx` line 158-177) has no `<thead>` at all — jumps straight into `<tbody>` — and each row prints the raw `{s.seats}` number with an inline `{tr.venuesPage.seatsLabel}` suffix instead (a workaround for the missing header, not a match for it). Neither the per-row nor the Total-row seat count uses `toLocaleString`, unlike Price which does.

## Gap 13 — Both pages render narrower than the export's shared column width

Export: both `VenuesDirectory.tsx` and `VenueDetail.tsx` wrap content in `mx-auto max-w-[1240px] px-6 ... md:px-10` (1240px column, 24px padding growing to 40px at `md:`).

Live: directory `page.tsx` line 97 uses `maxWidth: '1000px'`; detail `VenueDetailClient.tsx` line 96 uses `maxWidth: '1100px'`. Both use fixed `padding: '48px 24px'` with no responsive escalation to 40px horizontal padding at wider viewports. Both pages read measurably narrower/more cramped than the export intends, and the two pages don't even match each other.

## Gap 14 — Missing results-count line between controls and grid

Export (`VenuesDirectory.tsx` line 99-102):
```tsx
<div className="eyebrow mt-6 text-cream-faint">
  {filtered.length} {filtered.length === 1 ? "space" : "spaces"}
  {city !== "All cities" && ` in ${city}`}
</div>
```

Live `VenuesGridClient.tsx` has no equivalent anywhere — jumps straight from the search/city controls into the grid, with no live feedback on how many results match the current search/city filter. Found while rebuilding the controls row for Gaps 6-8, not part of the original 13.

---

## Re-checked, no action needed

- **Photo.tsx duotone treatment** (used for real venue photos on both pages) — doesn't literally use CSS `sepia()`/`saturate()` like the export's `.duotone` class, but achieves the same warm amber/sepia cast via `grayscale(1) contrast(1.25) brightness(0.9)` plus a `#C9973A` multiply-blend overlay at 0.48 opacity. Visually equivalent, deliberately documented, correct.
- **SiteNav's generic "back" link** on the detail page — not the export's page-specific eyebrow-styled arrow-left link. Shared across every detail-page type sitewide (Artists, Events, etc.), not Venues-specific, and already a considered call in the BUG-2608-072 brief ("fine to leave as-is unless it's a quick match"). Left as-is.
- **Owners-tab grid breakpoint strategy** (`auto-fill, minmax(280px, 1fr)` vs export's `sm:grid-cols-2 lg:grid-cols-3`) — already explicitly adjudicated as "not a gap" in the BUG-2608-073 brief. Re-confirmed, still a reasonable equivalent.

---

## Fix plan

Gaps 1-4, 12 are pure styling-value corrections. Gap 5 needs the tier badge lifted out of `VenueNoPhoto` to a card-level overlay. Gaps 6-8 touch the search/city filter controls (7 needs a small custom listbox, porting the chevron icon). Gap 9 is a one-line token swap. Gap 10 needs a real multi-photo grid on the detail page. Gap 11 needs a stylesheet class for the tab hover, same pattern as the existing `.afa-venue-card:hover` rule. Gap 13 is a container max-width/padding correction on both pages.

## Verification

- [x] `tsc` clean against baseline — `npx tsc --noEmit` shows zero errors in any touched `src/` file (the only output is 5 pre-existing, gitignored `.next/dev/types/*` errors from a stale generated-types file, unrelated to this change and present before it).
- [x] All 11 i18n dictionaries updated together for every copy change (`sectionColumnLabel`/`seatsColumnLabel`/`priceColumnLabel`, `resultsCountSingular`/`resultsCountPlural`/`resultsCountInCity`) — real translations, not English placeholders.
- [x] Zero off-palette hex, zero emoji in any added/changed line (checked via `git diff` on every touched file).
- [x] Dev server boots clean and the directory page renders (hero, toggle, empty state) with no console errors traceable to this change, desktop and mobile viewports both screenshotted.
- [ ] **Real screenshots of the live QA directory + detail pages (with and without photos/facilities) diffed against the export — NOT completed, and flagged here rather than silently checked off.** `.env.local`'s `DATABASE_URL` in this sandbox is still the redacted `"[SENSITIVE]"` placeholder from the exact gotcha the prior session's HANDOFF.md flagged ("fixed locally, gitignored" — that local-only fix doesn't persist across a fresh checkout/sandbox reset since the file is gitignored). Every DB-backed view — the venue card grid, tier badges, the Owners tab with real data, and the entire detail page — renders its empty/not-found fallback here instead of real content, so gaps 5, 7, 8, 10, 12, 14 (anything that needs real venues) could not be visually diffed against the export in this environment. The directory hero/toggle/empty-state did render and screenshot cleanly (confirms gaps 1-2, 6 partially, 9, 13 structurally), but this is not the real verification pass the brief asked for.
- [ ] Desktop and mobile for the DB-backed views above — blocked by the same gap.

**Needs a real DATABASE_URL locally, or a screenshot pass against the deployed QA/Vercel preview once this branch is up** — same outstanding item the previous HANDOFF flagged for BUG-2608-072/073 ("neither PR's live Vercel deployment was re-screenshotted after merge this session"). Recommend that pass happens before/at merge, not skipped again.
