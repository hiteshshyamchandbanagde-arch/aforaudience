# Accessibility Guidelines

UI/UX audit Section 09 / Step 6, sub-spec 2/5 (second of five one-page
specs, after `docs/motion-guidelines.md`). Scope: contrast + focus-visible
only - no screen-reader pass, no keyboard-trap audit, no heading-hierarchy
check. Every ratio below was independently recomputed from real `globals.css`
hex/rgba values and real component background context (qa @ `d304ce5`),
using the WCAG relative luminance formula with alpha-blending onto the
actual background color - not assumed from a prior analysis. One of this
pass's own inputs turned out to need correcting; see the note under
Section 1.

## 1. Contrast table

All ratios computed via relative luminance `L = 0.2126R + 0.7152G + 0.0722B`
(each channel linearized per WCAG's `c/12.92` below 0.03928, else
`((c+0.055)/1.055)^2.4`), `contrast = (L_light + 0.05) / (L_dark + 0.05)`.
Any `rgba()` value is alpha-composited onto its real background color
before computing, not treated as opaque.

| Pairing | Ratio | AA normal (4.5:1) | AA large/UI (3:1) | Verdict |
|---|---|---|---|---|
| `--afa-text-muted` on `--afa-surface-page` (#141414) | 3.61:1 | Fail | Pass | UI/large-text only |
| `--afa-text-muted` on `--afa-surface-raised` (#1F1F1F) | 3.55:1 | Fail | Pass | UI/large-text only |
| `--afa-error` text on its banner bg, dashboard context (banner tint over `--afa-surface-page`) | 2.68:1 | Fail | Fail | Real AA failure |
| `--afa-error` text on its banner bg, card/sheet context (banner tint over `--afa-surface-raised`) | 2.40:1 | Fail | Fail | Real AA failure, worse than the dashboard case |
| `--afa-red-alt` (candidate) on the dashboard-context banner bg | 4.66:1 | **Pass** | Pass | Clears AA in this context |
| `--afa-red-alt` (candidate) on the card/sheet-context banner bg | 4.17:1 | Fail (just short) | Pass | Does **not** clear AA in this context |
| `--afa-amber` on its info-box bg, dashboard context | 6.26:1 | Pass | Pass | Fine |
| `--afa-amber` on its info-box bg, card/sheet context | 5.52:1 | Pass | Pass | Fine |

**Correction to this dispatch's own starting numbers:** the brief for this
pass stated the error-banner/red-alt ratios as 2.68:1 / 4.66:1 flat. Those
numbers are only correct when the banner sits directly on
`--afa-surface-page` (`#141414`) - true for `ErrorBanner.tsx`'s ~20
dashboard usages, since `DashboardShell.tsx` sets `background:
var(--afa-surface-page)` on its own root wrapper. But grepping the exact
`rgba(179,38,30,0.1)` background value found 3 more real usages
(`(auth)/login/page.tsx`, `AuthPromptSheet.tsx`, `CorporateInquiryModal.tsx`)
that place the same banner inside a `var(--afa-surface-raised)`
(`#1F1F1F`) card or bottom sheet instead - a meaningfully darker base that
gives **both a worse failure today (2.40:1) and a red-alt candidate that
still falls short of AA (4.17:1)**, not a uniform pass. Both real contexts
are now in the table above; neither was silently dropped.

## 2. Focus-visible fix - applied

`.afa-focusable` (defined in `globals.css`, unchanged) adds a visible
`:focus-visible` ring to the click-guard `role="link"`/`role="button"`
`<div>`s used for card-grid navigation. Before this pass, 2 of the real
click-guard files already had it (`OrganisersGridEmbed.tsx`,
`VenuesGridClient.tsx`); 8 did not.

**Correction to this dispatch's own starting count:** the brief said 12
files matched `role="link"`/`role="button"` with 3 already compliant.
Re-grepping found 2 of those 12 hits are comments, not real elements -
`globals.css`'s own comment describing the pattern, and
`organisers/[id]/page.tsx`'s comment explaining it *avoided* a role-div in
favor of a real `<Link>` (confirmed: that file has zero actual
`role="link"`/`role="button"` attributes; its one `afa-focusable` usage is
on the real `<Link>`, unrelated to this fix). Net result: 10 real
click-guard files, 2 already compliant, 8 to fix - the same 8-file target
list the dispatch gave, just for a corrected reason.

**Fixed - added `afa-focusable` to the existing `className`, or added
`className="afa-focusable"` where none existed (no other change):**

| File | Elements fixed |
|---|---|
| `components/EventCard.tsx` | 2 (`EventCard`'s grid/list card, `EventRow`'s compact row - both independently missed it) |
| `app/tickets/page.tsx` | 1 |
| `app/dashboard/artist/page.tsx` | 1 |
| `app/(public)/artists/page.tsx` | 1 |
| `app/(public)/venue-owners/page.tsx` | 1 |
| `app/(public)/organisers/page.tsx` | 1 |
| `app/(public)/wall-of-fame/page.tsx` | 2 (organiser-tab card, venue-tab card) |
| `components/VenueOwnersGridEmbed.tsx` | 1 |

10 elements across 8 files - `EventCard.tsx` and `wall-of-fame/page.tsx`
each had two independent click-guard divs, not one; both are fixed. No new
CSS, no behavior change - same existing `:focus-visible` rule, just
applied where it was missing. `tsc --noEmit` clean.

## 3. Flagged, not fixed - needs Hitesh's call

### 3.1 `--afa-error`'s contrast failure and the `--afa-red-alt` candidate

`--afa-error` (`#B3261E`) text fails AA in both real contexts (2.40-2.68:1,
Section 1). Retargeting the single `--afa-error` variable to
`--afa-red-alt`'s hex (`#EF4444`) would fix all ~54 text-color usages at
once with zero component changes - but it's not a clean win:

- It clears AA for the dashboard-context banners (4.66:1) but still falls
  short for the card/sheet-context ones (4.17:1, Section 1).
- `--afa-error` is also used as a **background fill**, not just text, in
  at least 2 places - retargeting the base hex changes those too:
  - `dashboard/admin/feedback/page.tsx`'s CRITICAL severity badge
    (`background: var(--afa-error)`, text `var(--afa-on-fill-solid)` =
    `#1A1000`): **currently failing AA at 2.87:1** - retargeting to
    `#EF4444` would fix it, to 4.99:1.
  - `OfflineBanner.tsx` (`background: var(--afa-error)`, text `white`):
    **currently passing comfortably at 6.54:1** - retargeting to
    `#EF4444` would break it, down to 3.76:1 (fails AA normal text, still
    clears the 3:1 large/UI threshold).

So a flat retarget fixes one real failure (the CRITICAL badge) while
regressing one real pass (`OfflineBanner`), and only partially fixes the
text-color case it was proposed for. This needs a judgment call, not a
mechanical swap - left to Hitesh, not implemented here.

### 3.2 `--afa-text-muted`'s AA failure - usage rule, not a token change

`--afa-text-muted` (`rgba(245,245,240,0.4)`) fails AA for normal text
(3.55-3.61:1, Section 1) but passes the large-text/UI-component threshold
(3:1). **Rule: use it only for UI chrome, labels, and large text - never
for normal-weight, sentence-length body copy.** Most of its ~35 usages are
correctly scoped this way (uppercase mono labels, icon tints, 9.5-12px
metadata) - but grepping every usage with its `fontSize` found 5 real
misuses, all the same shape: an **empty-state sentence** rendered at
13-14px (the app's `--afa-text-body` tier) in `text-muted`:

- `components/OrganisersGridEmbed.tsx:182` - `org.bio` fallback ("no bio
  yet" placeholder), 14px, `lineHeight: 1.5`
- `app/dashboard/venue-requests/page.tsx:241` - "Waiting on the other side
  to respond.", 13px
- `app/dashboard/venue/sales/page.tsx:233` - "No venues yet.", 14px
- `app/dashboard/venue/sales/page.tsx:312` - "No bookings in this range.",
  13px
- `app/dashboard/venue/bookings/page.tsx:240` - "No pending booking
  requests.", 14px

All 5 are genuine readable sentences, not labels - logged as a candidate
follow-up ticket (re-point these 5 to `--afa-text-secondary` or similar,
TBD), not fixed in this pass.

## 4. Rule: checking contrast before shipping new UI

Before pairing any new text color with a new background, compute the real
ratio rather than eyeballing it:

1. Get the actual rendered colors - if either side has an alpha channel,
   alpha-composite it onto what's actually behind it (the real parent
   background in the component tree, not an assumption) before computing
   anything. Section 1's correction above is exactly what goes wrong when
   this step is skipped.
2. Apply the WCAG relative-luminance contrast formula (Section 1) to the
   composited colors.
3. Normal body text needs 4.5:1; large text (≥24px/≥19px bold) and UI
   components (borders, icons, focus indicators) need 3:1.
4. If it fails, don't ship it as body copy - either pick a different
   token or confine the use to large text/UI, per the `--afa-text-muted`
   rule above.

## Built

- **12 Sep 2026** - `afa-focusable` added to the 8 files/10 elements in
  Section 2. No visual or behavioral change - same existing CSS rule,
  applied where previously missing. Verified via diff + `tsc --noEmit`;
  real Tab-key click-through verification pending (see design.md entry).
