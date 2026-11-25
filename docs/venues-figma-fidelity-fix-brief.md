# Fix brief — Venues pages, Figma fidelity gap (BUG-2608-072)

**Decision (19 Aug):** this fix goes through Claude Code, not through chat. GEN-2608-074's build (PRs #502/#503) was written and executed by the same person in the same sitting - the brief-writer never got a check from anyone but themself, and a real gap shipped as a result. This brief is written to leave zero scope judgment calls for whoever executes it - every value below is pulled directly from the approved Figma Make export source (not re-eyeballed from screenshots), so implementation should be closer to mechanical than interpretive. If anything below is genuinely ambiguous, stop and ask rather than deciding.

**Source of truth:** `C:\Users\hites\AforA\aforaudience\Figma\Redesign Venues Directory Pages` - specifically `src/pages/VenuesDirectory.tsx`, `src/pages/VenueDetail.tsx`, `src/components/VenueCard.tsx`, `src/components/VenueMedia.tsx`, `src/index.css`. Every gap below quotes the real export line, not a paraphrase.

**What NOT to redo:** the token migration itself (colors, `Photo.tsx` duotone reuse, `filter: brightness(1.1)` hover convention, opacity-based dimming, the six off-palette hex values already caught and avoided) was correct and doesn't need touching. `VenueNoPhoto`'s three capacity-tier illustrations (`IntimateRoomMark`/`MidHallMark`/`LargeArenaMark`) are a reasonable interpretation of the export's line-art and can stay - the gaps are in layout, copy, and interaction, not in the icon art itself. The real Prisma field wiring (`photos`, `acousticRating` now threaded through) was correct and stays.

---

## Gap 1 — Directory hero copy was never actually changed

The build brief said "light token-migration pass only, not a rebuild" for `VenuesHero.tsx` - wrong call. The hero's copy, eyebrow line, and structure were real, approved content from the export, not just decoration.

Live now (`VenuesHero.tsx`): headline pulls `tr.venuesPage.heading` ("Venues"), subtitle pulls `tr.venuesPage.subtitle` ("Spaces hosting live art near you."), no eyebrow line at all.

Export (`VenuesDirectory.tsx` lines ~23-32):
```
<span className="eyebrow text-amber">Directory · {venues.length} spaces</span>
<h1 className="mt-5 max-w-3xl font-display text-[clamp(2.75rem,7vw,5rem)] font-medium leading-[0.95] tracking-[-0.02em] text-cream">
  Where the <em className="font-normal italic text-amber">show</em> happens.
</h1>
<p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-cream-dim">
  Every room has a temperament - the hush of a black box, the roar of an arena.
  Browse the spaces hosting live performance across India.
</p>
```

Fix: update `venuesPage.heading`/`venuesPage.subtitle` i18n keys (all 11 locales, real translations) to this copy, add a new `venuesPage.eyebrowDirectory` key ("Directory · {count} spaces" pattern, count interpolated), and rebuild the heading markup with the italic "show" treatment and the `clamp()` responsive sizing shown above. Border-bottom under the whole header block (`border-b border-ink-600 pb-10`), not the current left-rule-on-subtitle treatment.

## Gap 2 — Search placeholder copy unchanged

Live: "Search venues, cities...". Export: `placeholder="Search by name or city"` (`VenuesDirectory.tsx` line ~63). Update the `venuesPage.searchPlaceholder` key across all 11 locales.

## Gap 3 — Venues/Owners tabs: missing counts, wrong visual treatment entirely

Live (`VenuesViewToggle.tsx`): pill-shaped buttons, solid-fill active state, no counts.

Export (`VenuesDirectory.tsx` lines ~34-48): underline-tab style, not pills - `-mb-px pb-4` with a `border-b` on the row and an absolutely-positioned `h-[2px] bg-orange` underline on the active tab only. Each tab shows a small superscript count next to the label: `<span className="ml-2 align-super text-[0.7rem] font-normal text-cream-faint font-mono">{count}</span>`. Inactive tab text is dimmed (`text-cream-faint`), active is full `text-cream`.

Fix: rebuild `VenuesViewToggle.tsx`'s tab markup as underline tabs with counts, not pills. Counts: `venues.length` / owner count (check what's available - `VenueOwnersGridEmbed` may need its count lifted up a level, or fetched separately for the tab label).

## Gap 4 — Card: wrong corner radius, missing hover interactions, wrong title size, wrong price treatment

Live (`VenuesGridClient.tsx`): `borderRadius: "10px"`, title `20px`, price shown in bold amber, no hover color-shift.

Export (`VenueCard.tsx`):
- **No rounded corners anywhere** - `border border-ink-600` only, sharp edges. This is a real aesthetic signature of this direction (confirmed also in the detail page - nothing in either file uses a border-radius utility). Remove `borderRadius` from the card.
- Border hover: `group-hover:border-amber/60` - border itself shifts to amber on hover, not just an opacity/lift effect.
- Title hover: `group-hover:text-amber` - title text also shifts to amber on hover.
- Title size: `text-[1.65rem]` ≈ 26px, not 20px.
- Price: `<span className="eyebrow mt-3 text-cream-faint">` - quiet mono caps, dimmed cream, NOT bold amber. Live version made price louder than intended - tone it back down.
- Hover reveal: a circular arrow-up-right icon button fades in top-right of the photo on card hover (`opacity-0` → `opacity-100`, `backdrop-blur-sm`, `border-cream/20`, `bg-ink/40`). Not present in the live build at all - add it (new icon needed: arrow pointing up-right at 45°, can add to `VenueIcons.tsx`).
- Tier badge position/style is otherwise correct (top-left, `eyebrow` class, dimmed cream) - keep as built.

## Gap 5 — Detail page: wrong information architecture, not just wrong spacing

This is the largest gap. The live `VenueDetailClient.tsx` stacks everything (stats, facilities, seating table) into a single bordered card, one column, on every screen size. The real export is a **two-column desktop layout**: main content column + a distinct sticky sidebar, only collapsing to one column on mobile.

Export (`VenueDetail.tsx` line ~86): `<div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">` - single column below `lg`, `1fr` main + fixed `320px` sidebar above it. Sidebar: `<aside className="lg:sticky lg:top-10 lg:self-start">`.

**Main column contents, in order:** Seating & Pricing (heading + section count + full table with a `Total` footer row), then Facilities (icon+label rows, 2-column on `sm:` and up).

**Sidebar contents, in order (this whole block is currently missing from the live build):**
1. Total Capacity stat (icon + eyebrow label + large number)
2. Acoustic Rating stat (icon + eyebrow label + large number **with a `/5` suffix** - live build shows the bare number with no unit at all - or "Not rated yet" in italic when null)
3. A **second, separate, full-width "Follow this venue" button** (distinct from the compact Follow button up in the header) - `mt-5 flex w-full items-center justify-center gap-2 py-3.5`
4. A caption below it: "Get notified when new shows are announced here."

Fix: rebuild `VenueDetailClient.tsx` around this real two-column grid, move stats + the second Follow CTA into the `<aside>`, keep Seating/Facilities in the main column. Also add the page-level eyebrow line above the title (Gap 6) and the "All venues" back-link eyebrow style (small thing, currently using `SiteNav`'s generic back button - fine to leave as-is unless it's a quick match).

## Gap 6 — Detail page: missing page-level eyebrow, and the no-photo caption doesn't name the tier

Export header (`VenueDetail.tsx` line ~29): `<span className="eyebrow text-amber">{venue.city}, {venue.state} · {tierLabel(venue.capacity)}</span>` sits directly above the `<h1>` title. **Not present at all in the live build.** Add it.

No-photo caption - live build shows a static, generic string ("No verified photos yet - illustration shown for reference only.") that doesn't say which tier. Export interpolates the real tier into the sentence: `No verified photos — illustration reflects a {tier} room` (lowercase tier word). This is more informative and was the actual approved copy - update the `venueDetailPage.noPhotosCaption` key (all 11 locales) to a template with a `{tier}` placeholder and interpolate `tierLabel(capacity).toLowerCase()` (watch article agreement per locale - English needs "an intimate room" vs "a mid-size/large room"; check whether the locale's grammar needs a similar adjustment or can sidestep it entirely).

## Gap 7 — Also no rounded corners on the detail page

Same sharp-edged signature as the card grid - the gallery/hero illustration container, the `<aside>` stat rows (`divide-y divide-ink-700 border-y border-ink-600` - full-width dividers, not a boxed card), and the Follow buttons all use zero border-radius in the export. The live build's `borderRadius: "12px"` on the main card, hero image, and buttons should come out.

## Gap 8 — Follow button hover color

Export line ~40 and ~168: `hover:bg-[#ff6d4d]` - this is the same off-palette stray hex flagged in the original GEN-2608-074 audit (correctly not ported verbatim there). Confirm the live build's `filter: brightness(1.1)` substitute is actually wired up on both the header Follow button and the new sidebar "Follow this venue" button once built.

---

## Verification checklist before opening a PR

- [ ] Side-by-side screenshot comparison against the actual Figma Make export screenshots (not just a read-through of this brief) before calling it done - this is exactly the step that was skipped last time.
- [ ] Desktop AND mobile - the two-column detail layout only applies at `lg:` (1024px+); confirm it collapses to one column below that, sidebar content appearing after the main content, not before.
- [ ] `tsc` clean against the known baseline.
- [ ] All 11 i18n dictionaries updated together for every copy change, not just `en.ts`.
- [ ] Zero off-palette hex, zero emoji (repeat the same greps used in the original GEN-2608-074 audit).
