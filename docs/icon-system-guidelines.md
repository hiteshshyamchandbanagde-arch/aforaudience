# Icon System Guidelines

UI/UX audit Section 09 / Step 6, sub-spec 3/5 (third of five, after
`docs/motion-guidelines.md` and `docs/accessibility-guidelines.md`). Scope:
inventory + overlap diff + icon-only-button labeling. No consolidation, no
visual changes to any icon. Every count and path-data diff below was
re-derived from real file content (qa @ `0ed4f48`), not assumed from a
prior analysis - two of this dispatch's own starting numbers needed
correcting; see Section 1.

## 1. The three-system inventory

| System | File | Shape | Count |
|---|---|---|---|
| Shared registry | `components/DashboardShell.tsx` | One `Icon({name, size})` component, `switch` over an `IconName` union, exported | **17** names |
| Venue Portal | `components/dashboard/VenuePortalUI.tsx` | Standalone exported `Icon*`/`Icon*Glyph` function components | **19**, not 17 |
| Admin Overview | `app/dashboard/admin/page.tsx` | Standalone module-private (non-exported) `Icon*` function components | **7** |

**Correction:** the dispatch's brief stated `VenuePortalUI.tsx` at 17. The
real count is 19, split by the file's own comment into two deliberately
distinct buckets - easy to undercount if read as one flat list:
- **11** `Icon*` at 24x24 (`IconVenue`, `IconCalendar`, `IconChart`,
  `IconEdit`, `IconPlus`, `IconCheck`, `IconX`, `IconUsers`, `IconClock`,
  `IconTag`, `IconMap`) - standalone nav/action icons, each with its own
  overridable `size`/`strokeWidth` props.
- **8** `Icon*Glyph`-family at 16x16 (`IconSection`, `IconAisleV`,
  `IconAisleH`, `IconLevel`, `IconSeatGlyph`, `IconStageGlyph`,
  `IconLockGlyph`, `IconPhoneGlyph`) - inline glyphs that ride next to text
  in the Seating & Pricing fork / seat-map builder, own fixed `viewBox`/
  `strokeWidth` convention, only `size`/`style` overridable.

`IconName` (registry, verbatim): `dashboard`, `ticket`, `message`, `user`,
`calendar`, `plus`, `map`, `trendUp`, `dollarSign`, `briefcase`,
`building`, `music`, `grid`, `more`, `x`, `tag`, `settings` - 17, confirmed.

Admin's 7 (verbatim): `IconClipboard`, `IconClock`, `IconFlask`,
`IconCheckCircle`, `IconBulb`, `IconTicket`, `IconRupee` - confirmed. Note
`IconRupee` isn't actually a vector icon - it's `<span>₹</span>`, a text
glyph styled to match, not an SVG. Worth knowing if a future consolidation
treats "icon" as "always swappable for an `Icon` registry entry."

**~24 unique visual concepts across all three systems**, once overlaps are
collapsed (Section 2) - the number a consolidated `IconName` would need to
cover.

## 2. The overlap table - 5 shared concepts between the registry and `VenuePortalUI.tsx`

The dispatch asked to confirm drift per-icon rather than assume from the
one pre-confirmed case (`calendar`). Doing that found the 5 pairs split
three ways, not one bucket of "drifted":

| Concept | Verdict | Detail |
|---|---|---|
| `calendar` | **Drifted** | Registry: `rect x=3 y=4 18x18 rx=2` + 3 separate `<line>`s, `strokeWidth 1.75`. `VenuePortalUI`: `rect x=3 y=5 18x16 rx=2` + one `<path>`, `strokeWidth 1.5` (default). Different rect proportions *and* stroke weight, not just a line-vs-path authoring difference. |
| `plus` | **Identical** | Registry: two `<line>`s at `(12,5)-(12,19)` and `(5,12)-(19,12)`. `VenuePortalUI`: `path d="M12 5v14M5 12h14"` - same exact coordinates, same `strokeWidth 1.75` (both). Renders pixel-identical; just a line-vs-path authoring choice. |
| `map` | **Not drifted - a different pictogram entirely** | Registry: a folded paper-map outline (`polygon` + 2 fold lines). `VenuePortalUI`: a location-pin/teardrop marker (`path` + dot `circle`). Two completely different concepts sharing one name - this isn't proportion drift, it's two artists drawing two different things. |
| `tag` | **Drifted** | Registry: price-tag path + a tiny **filled** dot (`r=0.5 fill="currentColor"`), `strokeWidth 1.75`. `VenuePortalUI`: mirrored/differently-proportioned tag path + a larger **unfilled/stroked** ring (`r=1.3`, no fill), `strokeWidth 1.5` (default). Different orientation, different hole treatment, different stroke weight. |
| `x` | **Identical** | Registry: two `<line>`s, `(18,6)-(6,18)` and `(6,6)-(18,18)`. `VenuePortalUI`: `path d="M18 6L6 18M6 6l12 12"` - same coordinates, same `strokeWidth 1.75` (both). Pixel-identical, line-vs-path only. |

So: 2 of 5 render identically today (different authoring, same pixels), 2
have genuinely drifted (shape *and* stroke weight), and 1 (`map`) isn't
"drift" at all - it's two unrelated icons that happen to share a name,
arguably the one most worth a deliberate look since a user could see both
in the same session (desktop sidebar vs. Venue Portal) and reasonably
expect the same glyph.

## 3. The `IconClock` duplicate

Defined independently in both `VenuePortalUI.tsx` (line 84) and
`dashboard/admin/page.tsx` (line 60) - confirmed, not copy-pasted from one
another:

| | `VenuePortalUI.tsx` | `admin/page.tsx` |
|---|---|---|
| Shape | `circle r=9` + `path "M12 7v5l3 2"` | `circle r=8.5` + `path "M12 12V7M12 12l3.5 2"` |
| Stroke weight | `1.5` (default, overridable) | `1.6` (fixed, no prop) |
| Size | `20` (default, overridable via prop) | `18` (hardcoded, **no props at all**) |

Both are a circle + hour/minute hands, close enough to look like the same
icon at a glance, but independently drawn - different radius, different
stroke weight, different hand length, and a structurally different API
(admin's icons take zero props; `VenuePortalUI`'s take `size`/`style`/
`strokeWidth`).

## 4. Icon-only buttons missing `aria-label` - fix applied

**Real check performed**, not assumed: grepped every `<button` in `src/`
(287 matches across 82 files) and every existing `aria-label` (55 across
35 files) as a baseline, then read full multi-line blocks around every
icon-heavy file - navigation chrome (`SiteNav.tsx`, `MobileTopBar.tsx`,
`MobileTabBar.tsx`, `DashboardShell.tsx`), the seat-map builder, rating
flows, modals/sheets, save/follow toggles, and the admin feedback panel.
This was a thorough sweep of the highest-likelihood surfaces, not a
byte-for-byte read of all 287 - see the note at the end of this section.

**Found and fixed - 15 elements across 3 files, all label-only additions:**

| File | Element(s) | Label added |
|---|---|---|
| `components/SiteNav.tsx` | Account-menu button, logged-out state (renders only a person-outline SVG + chevron, zero text) | `aria-label="Account menu"` |
| `app/dashboard/venue/[id]/seat-map/page.tsx` | `removeLevel` button (had a `title` but no `aria-label`) | `aria-label={`Remove ${levelLabel(lvl)}`}` |
| `app/dashboard/venue/[id]/seat-map/page.tsx` | `removeRowGroup` button (bare `×`, no `title` either) | `aria-label={`Remove Section ${i + 1}`}` |
| `app/dashboard/venue/[id]/seat-map/page.tsx` | `removeVerticalAisleFromGroup` button | `aria-label="Remove vertical aisle"` |
| `app/dashboard/venue/[id]/seat-map/page.tsx` | `removeAisle` button | `aria-label={`Remove Gangway ${i + 1}`}` |
| `.../events/[id]/rate/RatePromptClientPage.tsx` | Both star-rating rows (overall `Stars` component + the separate per-performer inline row), 5 buttons each = 10 total | `aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}` |

The star-rating case is worth calling out: each button already renders a
visible character (`★`/`☆`), so it's not "icon-only" in the strictest
literal sense - but the glyph itself conveys no rating value to assistive
tech (every button in the row announces identically as "star, button"),
so it fails the same real test the dispatch is after even though it has
*a* character in it. Fixed on that basis.

**Found, not fixed - a judgment call, not a label gap:** the per-performer
numeric rating buttons in `EventDetailClientPage.tsx` (`{n}` rendered as
visible digit text, 1-5) *do* carry a genuinely distinguishing visible
label already ("3, button" is meaningfully different from "4, button") -
left alone rather than treated as equivalent to the star-glyph case.

**Scope note on thoroughness:** this sweep covered every icon-heavy
surface found while tracing from the three icon systems above, but did not
individually read all 287 `<button>` blocks across all 82 files (most are
pill/filter/status buttons with clear visible text, confirmed by sampling
rather than every instance). If a full, literal 100%-of-287 pass is wanted,
that's a bounded, well-defined follow-up - not claimed as done here.

## 5. Consolidation - recommendation, not implemented

Shape of a future consolidation, for whoever picks it up:
1. Extend the registry's `IconName` union from 17 to cover all ~24 unique
   concepts (Section 1) - add the 8 Venue Portal-only concepts plus
   Admin's 6 unique ones (`IconRupee`'s span-glyph excluded, or kept as a
   special case).
2. Have `VenuePortalUI.tsx` and `admin/page.tsx` import the shared `Icon`
   component instead of defining their own, dropping their private
   implementations.
3. Before step 2, resolve the 3 real conflicts from Section 2/3 -
   `calendar`, `tag`, `map` (genuinely two concepts), and `IconClock` -
   since consolidating means picking one winner per name, a visual
   decision this pass deliberately didn't make.

Real risk, not hypothetical: Venue Portal and Admin Overview are two full
page contexts a consolidation would visually touch end-to-end - out of
scope for a spec-writing pass, left to Hitesh to schedule as its own
ticket.

## 6. Sizing / strokeWidth convention - documented, not imposed

| | Registry | `VenuePortalUI` `Icon*` (24x24) | `VenuePortalUI` `*Glyph` (16x16) | Admin private |
|---|---|---|---|---|
| `viewBox` | `0 0 24 24` | `0 0 24 24` | `0 0 16 16` | `0 0 24 24` |
| `strokeWidth` | `1.75`, fixed for every icon | `1.5` default (`1.75` for Plus/Check/X) - overridable per call | `1.5`, fixed | `1.6`, fixed for every icon |
| `size` default | `16` prop | `20` default (`16` for Plus/Check/X) - overridable per call | `16` prop | `18`, hardcoded, **not a prop at all** |

Four different conventions, none wrong in isolation, but nothing today
enforces consistency if a 5th gets added. **Recommendation, Hitesh to
confirm before any future icon ships in any of the three systems:**
standardize on `viewBox 0 0 24 24`, `strokeWidth 1.75`, `size` default
`16` (registry's existing convention, reused by the two icons that already
render identically across systems - Section 2's `plus`/`x`). Not imposed
unilaterally here since it would require touching the other systems'
existing icons to actually enforce.

## Built

- **13 Sep 2026** - 15 `aria-label` additions across 3 files (Section 4).
  No visual change, no new component. `tsc --noEmit` clean. Diff reviewed
  line-by-line before this doc entry.
