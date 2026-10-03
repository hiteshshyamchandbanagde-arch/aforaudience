# Test coverage map: retest backlog

Which test closes which ticket (docs/testing-rules.md T5). A spec that
verifies a ticket carries the ID in square brackets in its test (or
describe) title, e.g. `test("[BUG-2609-077] ...")`, and
`e2e/ci-summary.mjs` prints `TICKETS PASSED: ...` / `TICKETS FAILED: ...`
from each run's report, so the nightly result can be read per ticket.

Status column: **tested** (spec and title below), **tested + HUMAN** (the
spec covers what a machine can judge; the HUMAN part stays open for
Hitesh), **HUMAN** (a machine can't judge it), **OBSOLETE** (superseded),
**untested** (no test yet: batch 2).

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
| FEAT-2608-047 | untested | | Batch 2: add a tour stop as Hrithik, save, see it on the public profile, remove it (restores his profile) |
| GEN-2609-114 | untested | | The goal spec does not assert 114's rules. Batch 2: modal backdrops use `--afa-scrim`; sage text on dark is the -bright variant (contrast ≥ 4.5) |
| GEN-2609-118 | tested + HUMAN | `design-system-goal.spec.ts` › `@needs-db [GEN-2609-118] [GEN-2609-119] [GEN-2609-121] an admin's token save reaches every visitor …` | Asserts the admin-editable `--afa-selected` token reaches every page. HUMAN: the orange/amber sweep and the demoted buttons (look and feel) |
| GEN-2609-119 | tested | `design-system-goal.spec.ts` (same test) | Manifest, theme-color and share poster follow their tokens. The ticket PDF and emails have no test-safe endpoint (the spec says so) |
| GEN-2609-121 | tested + HUMAN | `design-system-goal.spec.ts` (same test) | Asserts item 4 (the SiteNav active link follows `--afa-selected`). HUMAN: stage bars, artist/profile button styles (look and feel) |

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
| GEN-2609-006 | untested | | Batch 2: My Tickets cards show a QR that encodes the bookingId, and each status keeps its actions (needs a persona with bookings). HUMAN: poster-card look |
| GEN-2609-007 | untested | | Batch 2: save an event (heart), it appears on /saved, unsave (restores) |
| GEN-2609-008 | untested | | Batch 2: Profile hub at 390 lists the Create and Money & account rows and opens the fee sheet. HUMAN: look |
| GEN-2609-010 | tested | `seat-legend.spec.ts` › `[GEN-2609-010] Jaipur Mic Gala 100 seat map shows a price-tier legend matching its tiers` | |
| GEN-2609-012 | tested | `discover-carousels.mobile.spec.ts` › `[GEN-2609-012] Discover: every carousel on QA holds at least 3 events`; `[GEN-2609-012] Discover: a row under 3 events is not drawn; all-sparse falls back to the list` | |
| GEN-2609-013 | tested | `unified-tab-bar.mobile.spec.ts` › `[GEN-2609-013] [GEN-2609-017] /tickets/ and /profile/ show the unified bottom tab bar, signed out and signed in` | Reference bar is `/`'s: `/events` now has its own Discover bar (tabBarRoutes.ts) |
| GEN-2609-017 | tested | `unified-tab-bar.mobile.spec.ts` (same test) | Asserts exactly one bar on `/`, the unified one |
| GEN-2609-113 | untested | | Mostly a literal-to-token sweep, which the design-token ratchet guards. Batch 2: gold and error tone text on their tints ≥ 4.5 (the gold PENDING badge is already ≥ 4.5 in contrast.spec.ts) |
| GEN-2609-115 | untested | | Batch 2, `@needs-db`: a design-token restore runs the contrast check; the form-submit button text contrast on the auth pages |

## Counts (3 Oct 2026, batch 1)

| | Tickets |
|---|---|
| tested (incl. tested + HUMAN) | 26 |
| HUMAN only | 3 (BUG-2608-030, FEAT-2608-044, FEAT-2608-051) |
| OBSOLETE | 2 (BUG-2608-050, GEN-2609-003) |
| untested (batch 2) | 7 (FEAT-2608-047, GEN-2609-006, GEN-2609-007, GEN-2609-008, GEN-2609-113, GEN-2609-114, GEN-2609-115) |

Of the 26 tested, 4 also have a HUMAN item open (GEN-2609-118,
GEN-2609-121, GEN-2608-041, GEN-2609-004), so they stay open until
Hitesh confirms (T5).
