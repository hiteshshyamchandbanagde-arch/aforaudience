# Session Handoff — 5 Sep 2026 (BUG-2609-009 shipped as #558; QA demo personas added, uncommitted)

`qa` HEAD: `81e82e8` ("Fix BUG-2609-009: wrap all 13 nested dashboard pages in DashboardShell (#558)"). This was merged by a concurrent workflow between sessions - byte-verified as this thread's own pushed work, the 4th confirmed instance of this handoff-collision pattern.

## ⚠️ Uncommitted work sitting in the working tree right now

`scripts/qa-seed.ts` has real, tested, working changes **not yet committed** - do not `git checkout`/`reset --hard`/`stash drop` on this branch without first checking `git status` and preserving this diff. Confirm with Hitesh whether to commit before touching it.

What's in the diff (both pieces already run successfully against the live QA DB, not just written):

1. **New `seedDemoPersonas()`** - 8 fixed-ID, named QA login accounts (prefix `qa-demo-`, never `e2efixture`/`qa-golden`), called from `main()` before `printSummary`. Four cross-linked into one shared story (Vinayak's 6 venues host Omkar's 10 events; Hrithik performs/reviews/earns across 6 of them; Atul holds tickets + has a seeded message thread with Omkar), four deliberately sparse/unlinked (Orri, Vijay, Shahrukh, Amit) for empty/thin-state testing. All 8 use `VOLUME_PASSWORD` (`QaPass!2026`).
2. **Pre-existing `wipe()` bug found and fixed** - the FK-safe deletion order was missing `CorporateBookingInquiry`, `ArtistTourStop`, `TourArtistConsent`, and `Tour` (all reference Artist/Organiser with no cascade). The live QA DB actually had rows in 3 of those 4 tables, so `npm run db:seed:qa` hard-failed with a real FK violation (`CorporateBookingInquiry_artistId_fkey`) on the very first attempt this session - not a hypothetical, reproduced live. Fixed by inserting the 4 missing steps in correct order; re-run succeeded cleanly.

`tsc --noEmit` is clean on this diff. The QA database has already been wiped and reseeded with this data (ran `npm run db:seed:qa` for real, twice - once to hit the bug, once clean after the fix) - so the 8 demo accounts are live and usable right now regardless of whether the script change ever gets committed. **If someone re-runs `npm run db:seed:qa` without this diff committed, the demo personas and the wipe() fix both disappear on the next reseed.**

### The 8 demo accounts (all password `QaPass!2026`)

| Name | Role | Email | Shape |
|---|---|---|---|
| Vinayak | Venue Owner | vinayak.venue@aforaudience.qa | Full - 6 fleshed-out Pune venues |
| Omkar | Organiser | omkar.organiser@aforaudience.qa | Full - 10 events (2 past/completed, 1 pending-application-queue, 1 lineup-full, 6 plain published) across Vinayak's venues |
| Hrithik | Artist | hrithik.artist@aforaudience.qa | Full - applied/performed across 6 of Omkar's events, recorded PAID + BUY_IN compensation on the 2 completed ones, 2 reviews, 3 followers |
| Atul | Audience | atul.audience@aforaudience.qa | Full - 4 bookings (2 checked-in-past w/ reviews, 2 confirmed-upcoming), 1 seeded message thread with Omkar |
| Orri | Organiser | orri.organiser@aforaudience.qa | Partial - 1 unlinked draft event, nothing else |
| Vijay | Venue Owner | vijay.venue@aforaudience.qa | Partial - 1 thin venue, zero VenueAvailability rows |
| Shahrukh | Artist | shahrukh.artist@aforaudience.qa | Partial - bare profile, single genre tag, zero everything else |
| Amit | Audience | amit.audience@aforaudience.qa | Partial - zero tickets/bookings/messages |

### Schema gaps found while building this (worth knowing before touching Venue/Application/messaging again)

- **`Venue` has no `description` field at all** - only `VenueOwner.bio` exists for free-text venue narrative. The "real, not lorem" descriptive content the brief wanted went onto Vinayak's owner bio instead; the 6 venues themselves are differentiated through real names/addresses/capacity/facilities/pricing, not a description.
- **`ApplicationStatus` has no `ACCEPTED` value** (only `PENDING/APPROVED/REJECTED/WAITLISTED`) - "accepted" always means `APPROVED` in this schema, same mapping the pre-existing golden scenario already uses.
- **Message threads are never auto-created on booking/application confirmation.** `getOrCreateConversation()` (`src/lib/messaging.ts`) is only called lazily from the message-thread API routes on first open/send - confirmed by reading the source, not assumed. Any future "make sure this account has messages" ask needs the `Conversation`/`ConversationParticipant`/`Message` rows seeded directly, same as done for Atul here.

## 🔴 Next session — priority order

1. **Decide whether to commit `scripts/qa-seed.ts`.** It's tested and working (the QA DB already reflects it), just sitting uncommitted on `qa`. Losing this diff means losing both the demo personas *and* the wipe() fix on the next reseed.
2. **Admin nav (BUG-2609-008), deferred by explicit choice, unchanged since last handoff.** `/dashboard/admin/` has the same unwrapped-dashboard gap the other 3 roles had before #555-#558, but Admin's real surface (7 sub-areas: artists/bookings/diary/feedback/revenue/settings/users) is too big for a simple 3-5 item role section. Needs a design decision on nav shape before any code - not a straight wrap-and-link like the other 3 roles got.
3. **Rotate Razorpay + Google Places credentials** - still unresolved, only Hitesh can fix (both keys confirmed dead 25 Aug, 401/400 direct from each API).
4. **White-card-on-dark-shell** - still fully open, untouched.
5. **`--afa-terracotta` sweep** - items 7-11 of the theme-migration audit still open (bell emoji, `AuthPromptSheet`/`CorporateInquiryModal`/`SeatPicker`, remaining shared components, dashboard sweep blocked on the gold-contrast question below, bare `monospace` fontFamily).
6. **`--afa-gold` dark-on-dark contrast question** - still unresolved.
7. **`--afa-cream-tint-1/2`** - still live in `SeatPicker.tsx`/`LegalDocLayout.tsx`.
8. **Auth desktop brand panel's placeholder stock photo** - swap for real AFA photography when available.
9. **Profile page's two column-eyebrow labels** - deliberately skipped, needs a real i18n translation pass across all 11 locale files if wanted.

## What shipped this session, in order

**BUG-2609-009 (#558)** - all 13 nested dashboard pages (4 Venue Owner, 6 Organiser, 3 Artist) wrapped in `DashboardShell`, wrapper-only, every early-return branch included (a deliberate change from the #555-#557 convention of leaving loading/no-session unwrapped). Verified one page at a time, live, mocked-session Playwright per role. The two widest forms (Create Event, Register Venue) specifically confirmed to render at full usability with the sidebar present. Pushed as `preview/dashboard-shell-nested-pages`, deployed to Vercel preview, merged by a concurrent workflow as #558 before this session could open its own PR (4th confirmed handoff-collision instance).

**QA demo personas** - see the uncommitted-work section above. Full detail in the diff itself; every new id/table choice has an inline comment explaining the reasoning (why `bio` not `description`, why `APPROVED` not `ACCEPTED`, why messages needed seeding directly, why the wipe() fix was needed).

## Process notes worth remembering

- **A `--check-only` flag on a destructive script is worth actually using before running it for real** - `qa-seed.ts`'s own `assertQaDatabase()` guard was checked via `--check-only` before the real wipe+reseed, catching nothing wrong this time, but confirming the habit is cheap and worth keeping.
- **"This table has always been empty so far" is not the same as "this table will always be empty."** The `wipe()` FK-ordering gap (`CorporateBookingInquiry`/`Tour`/`ArtistTourStop`/`TourArtistConsent`) had presumably existed since those features shipped, silently harmless only because those tables happened to have zero rows on every past reseed. The first real data in them (from actual QA click-testing of the Tour/corporate-inquiry features) turned a latent bug into a hard failure. Any wipe-and-reseed script needs its FK-safe ordering re-audited against the *current* full schema periodically, not just extended incrementally per feature.
- **When a task brief asks for content a model doesn't support (e.g. "real venue descriptions" against a schema with no `Venue.description`), flag it and use the closest real field rather than either inventing a fake field or silently dropping the request.** Applied here for Venue description -> VenueOwner bio.
- **Verify "does X happen automatically" claims by reading the actual code path, not by assuming from the model shape.** Whether message threads auto-spawn on booking confirmation looked like a reasonable default to assume either way - reading `src/lib/messaging.ts` directly settled it in under a minute instead of guessing.

## Tally

32 PRs merged total (#527-#558). Zero pushed-and-awaiting-review. Zero reverted. One uncommitted-but-tested diff on `qa` (`scripts/qa-seed.ts`) awaiting a commit decision.
