# Figma Make Prompt — AforAudience Venue Owner Portal

Redesign the Venue Owner Portal for AforAudience, a live-events ticketing platform. This is a **dashboard/utility surface**, not a public marketing page — it's used by venue owners to manage their listings, bookings, and revenue. Six screens, one cohesive visual system.

## Design system to follow (real values from the shipped app — match these exactly, do not invent alternatives)

**This is a dark theme.** Base colors:
- Page background: `#141414`
- Raised panel/card background: `#1F1F1F`
- Deeper band (if a header/footer strip is needed): `#0A0A0A`
- Primary text: `#F5F5F0`
- Secondary text: `rgba(245, 245, 240, 0.65)`
- Muted/tertiary text: `rgba(245, 245, 240, 0.4)`
- Accent (icons, highlights, active states): `#C9973A` (warm amber/gold)
- Solid CTA fill color: `#FF5A36` (bright orange-red), with dark text on top of it

**Typography — three-tier system, use all three, don't substitute:**
- Headlines/page titles: **Newsreader**, a serif typeface with real italics and optical sizing. Use it via a `--font-display` variable for section headers and page H1s only — this is a deliberate serif accent against the sans-serif body, not a mistake to avoid.
- Body copy, form labels, general UI text: **Manrope**, a clean geometric sans-serif.
- Data/labels/badges/prices/stats: **IBM Plex Mono**, used specifically for anything numeric or tag-like (status pills, prices, counts, timestamps) — never for body paragraphs.

**Card convention — IMPORTANT, this is different from a typical "sharp corner" card system elsewhere on this platform:**
- Border radius: **12px** (rounded, not sharp)
- Border: flat `1px solid rgba(245,245,240,0.08)` — no hover color-shift needed, this isn't a browsable discovery grid
- Background: the raised panel color `#1F1F1F`

**Status pills/badges** (used for booking status, payment status, request status):
- Fully rounded: `border-radius: 999px`
- Small, uppercase, mono font, letter-spacing ~0.05em, padding ~5px 10px
- Color-coded by status — use a warm gold/amber family for pending/draft states, a muted green for approved/published, a muted red for cancelled/rejected, a neutral gray for completed. Keep each pill's background a soft ~12-15% opacity tint of its text color, not a solid fill.

**Buttons:**
- Primary/solid CTA: background `#FF5A36`, dark text, `border-radius: 8px`, padding ~12px 22px, semi-bold, no border
- Secondary/outline: transparent background, `1px solid rgba(245,245,240,0.2)` border, same radius and padding, primary text color

**Empty states — no stock photography, no emoji:**
- Illustrated placeholder pattern: soft crosshatch/graph-paper texture (thin 1px lines in the cream color at very low opacity, ~4%) over the raised panel background
- A simple line-art icon/mark in the amber accent color at reduced opacity (~55%), relevant to the empty content (e.g. a simple venue/building outline for "no venues yet," a calendar outline for "no bookings yet")
- A short caption below in mono font, small size, muted, uppercase

## The six screens

### 1. Your Venues (main dashboard landing)
Grid or list of the owner's venue listings as rounded cards (12px radius per above). Each card shows venue name (Newsreader), city/type as a small mono eyebrow, a status pill, and key stats (capacity, rate type — hourly/daily/flexible). Top of page: page title in Newsreader, plus three action items — Booking Requests link (with a pending-count badge), Flexible Requests link (with its own pending-count badge), and a "+ Register Venue" primary CTA button. Include an empty state per the pattern above for an owner with zero venues.

### 2. Edit Profile
Form to edit a single venue's details — name, description, address, capacity, rate type/pricing, photos, amenities. Use the raised-panel card as the form container, Manrope for all field labels and inputs, clear section grouping (e.g. Basic Info / Pricing / Photos / Amenities as separate sub-panels or a single scrollable form with visual section breaks). Standard save/cancel actions at the bottom using the button conventions above.

### 3. Revenue Overview
A real, visually substantial chart — not sparse. Use the amber accent as the primary data color (line or bar), dark chart background matching the page, gridlines in low-opacity cream, mono font for axis labels and any dollar/rupee figures. Below or beside the chart: summary stat cards (total revenue, bookings count, average booking value) as small rounded panels with the value in large mono font and a label in small muted text. Include a date-range selector.

### 4. Booking Requests (calendar)
A calendar grid view of incoming booking requests — move this off a plain white grid onto the dark theme. Days with requests get a subtle highlight; requests show as small colored chips using the status-pill color coding. Below or beside the calendar, a list view of individual requests as rounded cards with requester name, date/time, status pill, and accept/decline actions.

### 5. Flexible Requests
List of flexible-rate negotiation requests (this is a distinct inbox from the Booking Requests calendar — it's for venues with negotiable/flexible pricing rather than fixed rates). Each request as a rounded card: requester, proposed terms, status pill (pending/accepted/declined), and a response action. Include an empty state for zero pending requests.

### 6. Register Venue (form)
Multi-field form to add a new venue listing — similar structure and visual treatment to Edit Profile (#2), since it's the same underlying form pattern, but framed as a fresh "add new" flow. Same section grouping, same field/button conventions. Consider a simple step indicator if the form is long enough to benefit from one, but don't force multi-step if a single scrollable form reads cleanly.

## What NOT to do

- Don't apply sharp/zero-radius corners — that's a different part of this platform (public browsing pages), not this dashboard.
- Don't use stock photography or illustrations outside the crosshatch+line-art empty-state pattern described above.
- Don't invent a fourth typeface or deviate from the Newsreader/Manrope/IBM Plex Mono system.
- Don't make this feel like a public marketing/discovery page — it should read as a clean, functional back-office tool with tasteful polish, not a landing page.
