# Test coverage map: retest backlog

Which test closes which ticket (docs/testing-rules.md T5). A spec that
verifies a ticket carries the ID in square brackets in its test (or
describe) title, e.g. `test("[BUG-2609-077] ...")`, and
`e2e/ci-summary.mjs` prints `TICKETS PASSED: ...` / `TICKETS FAILED: ...`
from each run's report, so the nightly result can be read per ticket.

Status column: **tested** (spec and title below), **tested + HUMAN** (the
spec covers what a machine can judge; the HUMAN part stays open for
Hitesh), **HUMAN** (a machine can't judge it), **OBSOLETE** (superseded),
**untested** (no test yet).

The 38 tickets are the ones in `BUILD_COMPLETE` / `IN_TEST` on 3 Oct 2026
(dispatch B1). Specs marked `@needs-db` run in CI only (inside the shared
e2e queue), never in a local or autopilot run.

## BUILD_COMPLETE

| Ticket | Status | Spec › test title | Note |
|---|---|---|---|
| BUG-2609-055 | tested | `fonts.spec.ts` › `[BUG-2609-055] <page>: no text in a browser-default or bare generic font` (7 pages × 390/1440) | Seat Map Builder, venue sidebar, SiteNav, support chat panel, about, organiser tours, event detail |
| BUG-2609-065 | tested | `filter-sheet-focus.mobile.spec.ts` › `[BUG-2609-065] events filter sheet: focus moves in, Tab and Shift+Tab stay in, Esc closes and returns focus`; `[BUG-2609-065] events search box: typing in it does not open the filter sheet` | |
| BUG-2609-068 | tested | `chat-bubble.mobile.spec.ts` › `[BUG-2609-068] [BUG-2609-081] <page>: the chat button covers no bottom action at 390` (6 pages) | |
| BUG-2609-071 | tested | `organiser-events.spec.ts` › `[BUG-2609-071] organiser dashboard dates are day-first, in India time, …` | |
| BUG-2609-077 | tested | `events-load.spec.ts` › 3 tests `[BUG-2609-077] …` (normal, slow, failed `/api/events`; 390/1440) | |
| BUG-2609-078 | tested | `location-chip.spec.ts` › `[BUG-2609-078] changing the location chip on /venues relists the venues at once, …` | |
| BUG-2609-081 | tested | `chat-bubble.mobile.spec.ts` (as 068); `design-system-goal.spec.ts` › `@needs-db [BUG-2609-081] admin settings: Save buttons visible, uncovered and clickable at …` | Admin Settings needs the run's temp admin, so CI only |
| BUG-2609-082 | tested | `plurals.spec.ts` › `[BUG-2609-082] /events with 1 event …`, `… 2 events …`, `[BUG-2609-082] venue Sales: booking counts agree with their number` | English counts. Other locales' plural wording is translation quality |
| BUG-2609-083 | tested | `organiser-events.spec.ts` › `[BUG-2609-083] create page: an overnight 14 h 58 m event is billed as 15 hr …` | |
| BUG-2609-084 | tested | `organiser-tab-bar.mobile.spec.ts` › `[BUG-2609-084] organiser event detail shows one bottom bar, …` | |
| BUG-2609-087 | tested | `venue-revenue.spec.ts` › `[BUG-2609-087] venue Bookings 'This month' and Sales 'Month' show the same revenue, …` | |
| BUG-2610-004 | tested | `events-search.spec.ts` › `[BUG-2610-004] a ?search= arrival shows in the search box and searches every city`; `[BUG-2610-004] [BUG-2610-007] clearing the search box …` | |
| BUG-2610-006 | tested | `competition-show.spec.ts` › `[BUG-2610-006] competition show: the listing card shows the Competition badge` | |
| BUG-2610-007 | tested | `events-search.spec.ts` › `[BUG-2610-004] [BUG-2610-007] clearing the search box removes ?search= from the address` | |
| BUG-2610-003 | tested | `ticket-tier.spec.ts` › `[BUG-2610-003] the Jaipur Mic Gala 100 listing card shows its price from the tier, not '—'`; `[BUG-2610-003] My Tickets: a numbered-seat booking's card shows its tier name, not '—'`; unit: `scripts/booking-tiers.test.ts` | Dispatch C. Tier and price resolved at read time; no booking rows rewritten |
| BUG-2610-008 | tested | `colour-rules.spec.ts` › `[BUG-2610-008] /artists: the selected genre's underline is --afa-selected (amber), not the CTA orange` | Dispatch C |
| BUG-2610-009 | tested | `events-load.spec.ts` › `[BUG-2610-009] a slow /api/events never shows a '0 events' count before the events arrive` | Dispatch C |
| FEAT-2608-047 | tested | `artist-tour-stop.spec.ts` › `[FEAT-2608-047] a tour stop in another country, saved in the editor, is shown on the public profile; removed again` | Batch 2 (4 Oct). Hrithik, desktop only; his profile is compared field by field and put back in `finally` |
| GEN-2609-114 | tested | `scrim-backdrops.mobile.spec.ts` › `[GEN-2609-114] events filter sheet: the backdrop is --afa-scrim`, `[GEN-2609-114] dashboard tab bar More sheet: the backdrop is --afa-scrim`; `colour-closeout.spec.ts` › `[GEN-2609-114] profile: 'Visit your Organiser dashboard' is --afa-sage-bright, …`, `[GEN-2609-114] venue bookings: the outline 'Message Organiser' button's text is --afa-sage-bright, …` | Batch 2 (4 Oct). Closes the goal spec's gap: backdrops = the token's computed value; sage text = -bright, contrast ≥ 4.5 at 390/1440 |
| GEN-2609-118 | tested | `design-system-goal.spec.ts` › `@needs-db [GEN-2609-118] [GEN-2609-119] [GEN-2609-121] an admin's token save reaches every visitor …`; `colour-rules.spec.ts` › `[GEN-2609-118] checkout: the only orange element is the Pay button; 'See fee breakdown' is amber`, `[GEN-2609-118] booking confirmed ('You're going'): the count circle is amber, not orange; only View My Ticket is orange` | Dispatch C (4 Oct): the sweep's remaining look-and-feel check is now these colour assertions (390/1440). Orange = an action you tap, only |
| GEN-2609-119 | tested | `design-system-goal.spec.ts` (same test) | Manifest, theme-color and share poster follow their tokens. The ticket PDF and emails have no test-safe endpoint (the spec says so) |
| GEN-2609-121 | tested | `design-system-goal.spec.ts` (same test); `colour-rules.spec.ts` › `[GEN-2609-121] artist profile (Hrithik): each show's ticket link is the orange primary; '+ Follow' is an outline; prev/next arrows are not filled`, `[GEN-2609-121] a message thread's Send button is the orange primary` | Dispatch C (4 Oct): the two parts Hitesh had not seen (artist profile, Messages Send) are now tests |
| BUG-2609-066 | tested | `events-city-empty.spec.ts` › `[BUG-2609-066] a city with no events says 'No events in {city}' with Show all cities, never 'No events published yet'` | already fixed by #722; guard |
| BUG-2610-002 | tested | `artist-events-load.spec.ts` › `[BUG-2610-002] a failed load shows an error with Retry…`; `[BUG-2610-002] an All Cities load that answers after the city's load never replaces the city's list` | |
| BUG-2609-079 | tested | `event-card-price.spec.ts` › `[BUG-2609-079] …` (3 tests); `scripts/booking-tiers.test.ts` (withListingPrice) | |
| BUG-2609-070 | tested | `venue-sales-empty.spec.ts` › `[BUG-2609-070] By venue with no revenue anywhere shows the empty state…`; `…with revenue still draws the bar chart` | |
| BUG-2609-073 | tested | `flex-requests-badge.spec.ts` (@needs-db) › `[BUG-2609-073] Omkar's items count only requests waiting on him…`; `[BUG-2609-073] Vinayak declines the request and his badge drops at once…`; `scripts/flex-requests.test.ts` | |
| BUG-2608-091 | tested | `venue-past-requests.spec.ts` › `[BUG-2608-091] Past Requests rows show the booking date, and the end date when multi-day` | |
| BUG-2608-040 | tested | `venues-hindi-seats.spec.ts` › `[BUG-2608-040] /venues in Hindi: every card's seat count says सीटें…` | does not reproduce; guard |

## IN_TEST

| Ticket | Status | Spec › test title | Note |
|---|---|---|---|
| BUG-2608-030 | HUMAN | | Seat tapping and number legibility at 600 seats on a real phone; also waiting on a product decision (zoom/scroll) |
| BUG-2608-049 | tested | `artist-tour.mobile.spec.ts` › `[BUG-2608-049] artist edit, Tour at 390: no field narrower than its content, inputs usable` | |
| BUG-2608-050 | OBSOLETE | | Analysis of the 12-13 Aug CI failures (test bugs). Superseded by the e2e repair (#723) and the suite itself |
| BUG-2609-020 | tested | `role-menu-ssr.spec.ts` › `[BUG-2609-020] the dashboard role menu comes with the first server response, for the roles held` | |
| BUG-2609-050 | tested | `contrast.spec.ts` › `[BUG-2609-050] event edit: the <status> special-notes badge has text contrast of at least 4.5:1` (3 statuses × 390/1440) | The admin Overview all-clear banner (added 26 Sep) needs an admin: batch 2, `@needs-db` |
| FEAT-2608-044 | HUMAN | | Venues/Artists listing redesign: look and feel (photos, captions) |
| FEAT-2608-051 | HUMAN | | Full dark reskin: look and feel. Its font gap part is checked by BUG-2609-055's spec |
| GEN-2608-041 | tested + HUMAN | `language-rollout.spec.ts` › `[GEN-2608-041] language switcher: te/ta/kn/ml - …` | HUMAN: translation quality |
| GEN-2609-003 | OBSOLETE | | Phase 1 nav shell and fonts, superseded: the tab bar by GEN-2609-013/-017 and BUG-2609-084 (all tested), the fonts by the later font migration (layout.tsx) |
| GEN-2609-004 | tested + HUMAN | `smoke.spec.ts` › `[GEN-2609-004] Jaipur Mic Gala 100 event detail page loads and offers seat selection` | Asserts the seat picker is its own `/events/<id>/seats` route. HUMAN: the Discover/EventDetail restyle |
| GEN-2609-006 | tested + HUMAN | `ticket-qr.spec.ts` › `[GEN-2609-006] My Tickets: each confirmed card's QR encodes its bookingId; each status keeps its actions` | Batch 2 (4 Oct). Atul's 10 confirmed cards: the QR image's pixels, sampled per module, are exactly the symbol for that card's bookingId. CONFIRMED / PENDING (served unexpired in the browser) / EXPIRED / CANCELLED actions. HUMAN: poster-card look |
| GEN-2609-007 | tested | `saved-events.spec.ts` › `[GEN-2609-007] save an event with the heart, see it on /saved, unsave it there` | Batch 2 (4 Oct). Atul, 390/1440; his saved list is put back in `finally` |
| GEN-2609-007 | tested | `seed-health.spec.ts` › `[GEN-2609-007] seed health: each persona's saved city is the one the suite expects` | bundle-2-amend (7 Oct). Atul's saved city changed by hand on QA (Mumbai) turned saved-events red on every branch; global-setup puts it back (`helpers/persona-cities.ts`), this checks it first |
| GEN-2609-008 | tested + HUMAN | `profile-hub.mobile.spec.ts` › `[GEN-2609-008] profile hub at 390: Create and Money & account rows; Fee breakdown opens the fee sheet` | Batch 2 (4 Oct). The fee sheet's focus trap reuses 065's check (`helpers/focus.ts`). HUMAN: look |
| GEN-2609-010 | tested | `seat-legend.spec.ts` › `[GEN-2609-010] Jaipur Mic Gala 100 seat map shows a price-tier legend matching its tiers` | |
| GEN-2609-012 | tested | `discover-carousels.mobile.spec.ts` › `[GEN-2609-012] Discover: every carousel on QA holds at least 3 events`; `[GEN-2609-012] Discover: a row under 3 events is not drawn; all-sparse falls back to the list` | |
| GEN-2609-013 | tested | `unified-tab-bar.mobile.spec.ts` › `[GEN-2609-013] [GEN-2609-017] signed in, /tickets/ and /profile/ show the same bottom tab bar a visitor sees on /` | Signed in (Atul), the case the ticket fixed. Signed out is not testable: /tickets and /profile send a visitor to /login once the session loads. Reference bar is `/`'s: `/events` now has its own Discover bar (tabBarRoutes.ts) |
| GEN-2609-017 | tested | `unified-tab-bar.mobile.spec.ts` (same test) | Asserts exactly one bar on `/`, the unified one |
| GEN-2609-113 | tested | `colour-closeout.spec.ts` › 5 tests `[GEN-2609-113] …` (organiser Draft badge, artist pending / rejected application badges, 'Buy-in required', My Tickets Reserved badge) | Batch 2 (4 Oct). Gold = --afa-amber on --afa-amber-tint, error = --afa-error-bright on --afa-error-tint, contrast ≥ 4.5 at 390/1440. The literal-to-token sweep itself is guarded by the ratchet |
| GEN-2609-115 | tested | `design-system-restore.spec.ts` › `@needs-db [GEN-2609-115] a design-token restore runs the contrast check and reports it; the token ends as it started`; `auth-submit-contrast.spec.ts` › `[GEN-2609-115] /login/: the 'Sign In' submit button's text …`, `[GEN-2609-115] /register/: the 'Create Account' …` | Batch 2 (4 Oct). The restore test needs the run's temp admin, so CI only (not yet run at push) |

## Counts (4 Oct 2026, after batch 2)

| | Tickets |
|---|---|
| tested (incl. tested + HUMAN) | 36 |
| HUMAN only | 3 (BUG-2608-030, FEAT-2608-044, FEAT-2608-051) |
| OBSOLETE | 2 (BUG-2608-050, GEN-2609-003) |
| untested | 0 |

41 rows: B1's 38 tickets plus dispatch C's BUG-2610-003, BUG-2610-008
and BUG-2610-009. Of the 36 tested, 4 also have a HUMAN item open
(GEN-2608-041, GEN-2609-004, GEN-2609-006, GEN-2609-008), so they stay
open until Hitesh confirms (T5).

Batch 2 (dispatch B2, 4 Oct) moved the last 7 untested tickets:
FEAT-2608-047, GEN-2609-007, GEN-2609-113, GEN-2609-114 and
GEN-2609-115 to **tested**; GEN-2609-006 and GEN-2609-008 to **tested +
HUMAN**. GEN-2609-115's restore test is `@needs-db` (CI only).

Batch 1 (3 Oct): 26 tested, 3 HUMAN only, 2 OBSOLETE, 7 untested.
GEN-2609-118 and GEN-2609-121 moved to **tested** on 4 Oct (dispatch C:
`colour-rules.spec.ts` replaces their manual look-and-feel checks).

Dispatch C (4 Oct) also added BUG-2610-003, BUG-2610-008 and
BUG-2610-009 (tested, above), plus two checks with no ticket ID:
`seat-total.spec.ts` (a paid event shows "—", not "Free", before a seat
is chosen) and `ticket-actions.spec.ts` (My Tickets' three actions on one
row, each label at most 2 lines).

## UI/UX bundle 2 (7 Oct, `fix/uiux-bundle-2`)

| Ticket | Status | Spec › test title | Note |
|---|---|---|---|
| BUG-2609-086 | tested + HUMAN | `confirm-dialog.spec.ts` › `[BUG-2609-086] Cancel ticket opens the in-app sheet with paid, refund and the non-refundable fee` (@needs-db fixture booking); 4 Seat Map Builder tests (stale draft dropped, fresh draft offered with age in words, frozen map never offers + Unfreeze dialog, 412 frozen banner stacks); units `scripts/refund-policy.test.ts`, `scripts/seatmap-draft.test.ts` | HUMAN: the cancel sheet on a real phone |
| BUG-2610-017 | tested + HUMAN | `nudge-banners.spec.ts` › `[BUG-2610-017] phone-verify banner: one line, solid neutral surface, short copy, orange Verify`; `… on scroll the banner goes and the top bar sits at top 0 with nothing bleeding through`; `… the offline banner stays pinned while the page scrolls` (@needs-db throwaway unverified account) | HUMAN: banner look on a real phone. `phone-verify-nudge-i18n.spec.ts` literals follow the new copy |
| BUG-2610-015 | tested | `chat-bubble.mobile.spec.ts` › `[BUG-2610-015] my tickets status pills / admin users Suspend / admin revenue last column: the chat button never rests on them at 390` and `… at 360` (admin pages @needs-db, temp admin) | Counts only the chat button: Vercel's preview toolbar rests mid-screen too |
| BUG-2610-016 | tested | `admin-revenue.spec.ts` › `[BUG-2610-016] Top organisers: headers keep apart and line up with their values`; `… revenue chart: month names read horizontally, a ₹ value on each bar` (390 + 1440, @needs-db temp admin); unit `scripts/timeline-label.test.ts` | Baseline: header row only (values change with QA bookings) |

## UI/UX bundle 3a (8 Oct, `fix/uiux-bundle-3a`)

| Ticket | Status | Spec › test title | Note |
|---|---|---|---|
| GEN-2610-006 | tested + HUMAN | `account-locale.spec.ts` › `[GEN-2610-006] a language picked while signed in follows the account to a new browser`; `… the account value wins over the device on session load; a null account keeps the device's choice`; `… the server only accepts an offered language` (390 + 1440) | Atul's language put back after each test; global setup resets every persona's. HUMAN: pick on the phone, sign in on another device |
| BUG-2610-021 | tested + HUMAN | `location-chip-accounts.spec.ts` › `[BUG-2610-021] after Atul picks Mumbai and signs out, Hrithik signing in sees his own account city on the chip`; `… a client-side sign-in re-reads the chip: a guest's Mumbai gives way to Hrithik's account city` (390 + 1440, baseline of the chip) | Atul's city put back to Jaipur after the test; Hrithik's Ballari added to persona-cities + qa-seed. HUMAN: sign out / sign in on the phone |
| BUG-2610-019 | tested + HUMAN | `city-picker-focus.spec.ts` › `[BUG-2610-019] the city picker's search box takes focus on desktop only, never on a phone` (390 + 1440, baselines); `… a narrow desktop window (< 768 px) does not focus the search either` | HUMAN: tap the chip on a real phone, no keyboard |

## UI/UX bundle 4 (9 Oct, `fix/uiux-bundle-4`)

| Ticket | Status | Spec › test title | Note |
|---|---|---|---|
| BUG-2610-026 | tested + HUMAN | `chart-tooltip.spec.ts` › `[BUG-2610-026] By venue: the bar tooltip's value line is readable (AA) on the tooltip box` (baseline of the tooltip); `… Revenue over time: the area chart's tooltip is readable (AA) too` (390 tap + 1440 hover); unit `scripts/chart-tooltip.test.ts` (every Recharts `<Tooltip>` spreads `chartTooltipProps`) | Revenue figures set in the browser's copy of the API, so bars exist whatever QA's bookings. HUMAN: tap a bar on the phone |
| BUG-2610-029 | tested + HUMAN | `homepage-hindi.spec.ts` › `[BUG-2610-029] the homepage's main button is translated in every language` (11 locales, hi baseline); `… no English homepage copy is left on the Hindi homepage`; unit `scripts/i18n-untranslated.test.ts` (no value identical to en.ts on the homepage, /events, /venues, /artists, event detail, checkout; allow-list with reasons; prints leftovers elsewhere) | HUMAN: translation quality (new homepage copy in 10 locales, location strings in 6) |
| BUG-2610-030 | tested + HUMAN | `homepage-hindi.spec.ts` › `[BUG-2610-030] Hindi: the homepage eyebrow has no letter-spacing` (baseline); `… Hindi: the /events count labels have no letter-spacing`; `… English keeps its tracked, uppercase labels` (390 + 1440) | One rule in globals.css (`:lang()` on the 8 Indic locales). HUMAN: Hindi homepage on the phone |
| BUG-2610-032 | tested | `city-picker-loading.spec.ts` › `[BUG-2610-032] the city picker shows a loading state, not "no match", until its city list arrives` (held `/api/venues/cities`, baseline of the loading line); `… a failed city list is not shown as "no match"` (390 + 1440) | Signed out, no persona state touched |
