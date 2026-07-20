# AforAudience — Master Design Document v3.5
### The World's First Live Art Universe — Consolidated Product, Engineering & Delivery Plan
**Status:** Living document | **Supersedes:** onboarding sections of the original Web & Mobile design docs
**Working model:** Solo founder-developer + Claude acting as Architect / Senior Developer / QA collaborator

---

## 0. Document Purpose & What Changed

This document merges four prior artifacts into one source of truth:
- `AforAudience_Design_Document.md` (web product & business)
- `AforAudience_Mobile_App_Design_Document.md` (React Native app)
- `AforAudience_Revised_Onboarding_Flow.md` (browse-first access model)
- `AforAudience_Web_Login_Test_Plan.md` (QA gaps on auth)

**Ruling made this chapter:** Browse-first / guest-mode / login-at-commitment (from the Revised Onboarding doc) is now the **single standard for web and mobile**, replacing the old "Role Selection → Register → OTP → Profile Setup" flow everywhere it previously appeared, including the Mobile doc's §4/§5.3 and the Web doc's Register flow. Anywhere the two conflict, this document wins.

Since delivery is one person working with Claude as collaborator (not a multi-role team), the Agile plan in §10 is deliberately built for a **solo-developer + AI-pair cadence**, not a staffed sprint team — story points here are for prioritization and scope-sizing, not velocity commitments against a hiring plan.

**Amendment (this revision):** Added §4.5 — Venue Owner sets rental rates (Hourly/Daily/Flexible) and ticket pricing is now per-section, controlled by the Organiser, who also sets performer compensation (paid/free), performer count caps, and an approval-gate toggle for Artist applications. This pulled some Venue OS stories forward into Release 1 (see §8.2) since publishing an event now depends on a confirmed venue booking.

**Second amendment (this revision):** Ruled on the three open money decisions flagged in §4.5 — (1) auto-approval requires `isVerified` only, (2) venue rental is taxed via a **flat platform booking fee**, not a percentage, and (3) **both `PAID` and `BUY_IN` performer slots are commissioned**, which means `PAID` fees now settle as a real platform payout at T+2 rather than an off-platform promise — a materially bigger build than first scoped. A new open question follows directly from that: whether an Organiser needs a revenue check or guarantee deposit to cover promised `PAID` fees (§4.5, suggestion 9) — not yet decided.

**Third amendment — Implementation session, consolidated:** Release 0 shipped and is live in production, verified end-to-end with real accounts (not just code review): registration → login → password reset/lockout → contextual auth sheet → role upgrade (Organiser/Venue Owner) → Admin approval → venue creation, all walked through on the real deployed site. Also shipped from Release 1: the full economics schema foundation (applied live), per-section ticket pricing on event creation (E6), venue rental rate with Hourly/Daily/Flexible + day-of-week overrides (F4), the fix preventing an event from going live without venue booking confirmation, and showing/calculating the venue's rate at booking time for Hourly/Daily venues (Flexible intentionally left as a proposed-amount placeholder pending real negotiation UI — see §9.1). Three real bugs were found through actual testing (not caught in review) and fixed same-session — see §9 for the full list of what's shipped vs. still open, replacing the informal §9 notes from the design phase.

**Infra note, worth keeping close at hand:** `DATABASE_URL` must be Supabase's **Session Pooler** connection string (port `5432` on the `pooler.supabase.com` host), set for **both Production and Preview** environments in Vercel — Transaction pooler (port `6543`) doesn't reliably support the queries Prisma's migration tooling runs, and Direct connection is IPv6-only so Vercel can't reach it at all. Schema migrations are applied directly against Supabase via the Supabase MCP connector as their own explicit step, not through the Vercel build (the build script is plain `next build` — an earlier attempt to wire `prisma migrate deploy` into it caused a cascade of failed deploys and was reverted). Both the Vercel and Supabase MCP connectors are connected and used for verifying real deployments and querying the live database directly, rather than assuming from code alone.

**Fourth amendment — Follow-up session, consolidated:** Shipped Follow (G1) and Review (G2) — both genuinely from-scratch, not schema-only gaps like the performer economics cluster was. Shipped F3 (Venue Owner revenue summary + a lightweight custom month calendar). Ran a real security audit: found and fixed six routes that checked ownership but never checked `isApproved` (event edit, venue edit, venue booking request/confirm, both sides of Flexible negotiation, application approval) — only two routes had ever been checked before this pass. Also narrowed the TLS bypass in `src/lib/prisma.ts` — removed a **global** `NODE_TLS_REJECT_UNAUTHORIZED=0` that disabled certificate verification for every outbound connection the app makes (not just the database), leaving only the Postgres-specific bypass in place since it couldn't be safely verified from the sandbox. Confirmed via real production traffic (login, a real booking write, event pages) that the database connection survived the change.

Also fixed a real, previously-undiagnosed mobile bug: **no viewport meta tag existed anywhere in the app.** This was the actual root cause of the mobile layout appearing cropped rather than reflowing — a separate, deeper issue than the SiteNav hamburger-menu fix that shipped alongside it, and the reason that fix couldn't have worked on a real phone until this landed too. Once fixed, a systematic search for the same "fixed-width flex/grid" overflow pattern found and fixed three more real bugs: the homepage's stats row, Navarasa grid, and footer; and the event detail (booking) and artist profile pages' fixed-pixel sidebar columns (`1fr 380px` / `1fr 320px`) — the event detail one is very likely what was reported as "booking has issues" on mobile.

**Process note, worth reading if you're picking this up in a new conversation:** during this session, two pieces of work were built twice — once now-forgotten from earlier in this same long conversation, and rediscovered independently later without realizing it already existed (a role-upgrade/admin-approval flow, and a venue revenue/calendar view). Both times it looked like "another parallel collaborator" had done the work, but the user confirmed only one session was ever running — it was actually this same conversation's own earlier turns, no longer visible due to context-window limits. Cleanup: ~27 stale branches (mostly already-merged, never deleted after merging via API instead of GitHub's UI) were removed from the repo; only `main` remains. **If you're a fresh Claude picking this up:** check `main` and this doc's §9 for what's actually built before assuming a story needs starting from scratch — the doc is the reliable source of truth, not any single conversation's memory of itself.

**Fifth amendment — Economics model rewritten to match the published About page.** The About page shipped to `qa.aforaudience.com/about` commits the platform, in writing, to a specific promise: **"We will never tax the scene."** Not the venue owner. Not the organiser. Not the artist. Not the rental between a venue and an organiser. Not the fee an organiser pays a performer. That promise is the moat, and it now supersedes every prior ruling in this doc about how to commission which flow. §4.5 has been rewritten from the ground up to reflect this; §3's open-decisions table has retired the two "commission on X" rulings; the affected EPIC stories (E7, E11, E14, H4) have been reworded; and §9 has been updated to reflect what's dead, what stays meaningful in a new framing, and what's newly on the roadmap. The two prior commission rulings (second amendment) are formally reversed. Implementation-side confirmation added in sixth amendment: `PlatformSettings.ticketCommissionRate`, `performerSlotCommissionRate`, `flatVenueBookingFee` still exist as columns, are marked `@deprecated` in `schema.prisma` with JSDoc annotations, and are never read by application code. `audienceBookingFee` was added as a new column on the same table (not a rename of `flatVenueBookingFee`), preserving audit trail. **The About page is now the pricing constitution; §4.5 implements it. If they disagree, the About page wins.**

**Sixth amendment — QA shipping session, consolidated (13 Jul 2026).** Four PRs merged to `qa` in a single working day, taking Release 1 from ~20% shipped to mostly shipped. Checkpoint 2 (Razorpay payment integration) went end-to-end with a real card in QA: SDK wrapper, POST `/api/bookings` creates a PENDING booking in a Prisma transaction then a Razorpay order outside it (dodges the 5-second transaction timeout), redirects to `/checkout/[bookingId]`, verifies HMAC signature via confirm endpoint, transitions to CONFIRMED. Webhook at POST `/api/payments/webhook` handles browser-death race conditions. Free events auto-confirm immediately. Payment amounts stored in paise as integers, 15-minute PENDING TTL. Checkpoint 3 (ticket delivery) shipped PDF generation via pdf-lib (A4 editorial-tone), QR code encoding the booking ID (physically scan-verified), Resend email delivery with PDF attachment from `tickets@mail.aforaudience.com`, atomic single-flight delivery, on-demand ticket download endpoint, Download buttons on checkout success page and `/tickets` list. Checkpoint 4 (audience booking fee, EPIC K1) shipped end-to-end: fee configurable at `/dashboard/admin/settings` (ceiling ₹500, ships at ₹0 default), captured to `Booking.bookingFeeAmount`, visible as a separate line item at checkout. Fix B (User Display Name, new retrospective EPIC L) shipped: `User.displayName` separate from `User.name` (username), register form persists Full Name as displayName, Profile page lets existing users set/edit, tickets/emails/greetings use displayName with fallback to name. QA env: separate Supabase project (`aforaudience-qa`), qa branch auto-deploys to `qa.aforaudience.com` via a second Vercel project, prod stays on main → `www.aforaudience.com`. Env-label badge (`NEXT_PUBLIC_ENV_LABEL`) distinguishes Beta v1 (prod) from QA (preview). Transactional email working in QA via Resend with `mail.aforaudience.com` as the dedicated sending subdomain, DMARC monitoring in place. Real bug caught only through live testing and not code review: **free events auto-confirm but never receive PDF/email** — recorded as EPIC M for the next session (now shipped, see seventh amendment).

**Seventh amendment — This session (14 Jul 2026).** Two things shipped, both small: (1) EPIC M1 — the free-event ticket-delivery gap from the sixth amendment. Root cause: the atomic single-flight claim in `deliverTicket()` ran on `Payment.updateMany WHERE deliveredAt IS NULL`; free events have no Payment row, so the claim always affected 0 rows and delivery silently no-op'd. Additionally the free-event auto-confirm path in POST `/api/bookings` never called `deliverTicket()` in the first place. Fix: moved the claim from `Payment.deliveredAt` to `Booking.deliveredAt` so it works for both flows, wired the free-event auto-confirm path to fire `deliverTicket()` background-style (same pattern as the paid confirm route). `Payment.deliveredAt` / `Payment.deliveryError` are kept in the schema marked `@deprecated` to preserve historical audit trail; existing paid bookings' delivered state was backfilled onto Booking at migration time so any future admin-retry pathway doesn't re-fire them. Migration `20260714000000_ticket_delivery_on_booking` applied to `aforaudience-qa` before the code deploy (forward-compatible ordering). (2) This design document was consolidated into the repo as `docs/design.md` — previously it lived in project files and drifted between chat sessions. Going forward, doc edits go through PRs like any other code change; the doc is versioned with the code that implements it. Also this session: established the discipline that handoffs should be ≤60 lines (previous 300+ line format was burning 30–40% of every subsequent session's context budget for no useful gain), and that the design doc lives in the repo rather than in project files (the old habit was loading the entire 445-line doc into every message regardless of relevance).

**Eighth amendment — Same 14 Jul 2026 session, continued.** With Checkpoints 2–4 all shipped and the M1 free-event fix landed, the session had headroom for smaller loop-closers and mobile groundwork. Six PRs merged in this session total (#39 free-event delivery, #40 design doc consolidation, #41 PWA installable, #42 PWA score improvements, #43 admin retry endpoint, #44 displayName nudge). Notable landings: (1) **PWA — the app is installable on Android.** `src/app/manifest.ts` completed with maskable icons + shortcuts (Events/Tickets/Venues) + `lang`/`dir`; hand-written `public/sw.js` (~150 lines, no next-pwa/workbox dependency) implements network-first-with-offline-fallback for navigations, cache-first for `_next/static/`, stale-while-revalidate for `_next/image/`, and never-cache for `/api/`; a brand-consistent `public/offline.html`; inline `<script>` in the layout `<head>` registers the SW (moved from React client component after learning that PWA validators are static scanners that don't wait for hydration); a `beforeinstallprompt` interceptor renders a subtle install CTA with a 14-day dismissal window; brand icons at 192/512/maskable/apple/favicon sizes generated programmatically by `scripts/gen-pwa-icons.py` so future rebrands are reproducible in one command. Vercel Deployment Protection turned off across the project so PWABuilder.com could validate the manifest. **PWABuilder generated a working Android APK** (package ID `com.aforaudience.qa.twa`, throwaway signing key) — under the hood it uses Google's Bubblewrap tool. The APK was downloaded to Hitesh's phone but not yet installed; assetlinks.json setup is the next step to hide the URL bar in the TWA. (2) **EPIC M1's follow-up — admin retry endpoint.** `POST /api/admin/redeliver-ticket/[bookingId]` (ADMIN role required) atomically resets `Booking.deliveredAt`/`deliveryError` under a two-branch WHERE (either "previous attempt failed" or "delivered >30s ago so force-resend is safe"), then fires `deliverTicket()` background-style. 30-second cooldown protects against admin double-tap and against races with in-flight deliveries from the confirm/webhook path. Closes the loop `Booking.deliveryError` opened. No UI yet — Hitesh calls it via curl until an admin bookings list exists. (3) **EPIC L5 — displayName backfill nudge.** Subtle sticky top banner in brand-warm palette appears when a logged-in user has null `displayName`, links to `/profile`, dismissible for 14 days, self-hides on `/auth`, `/checkout`, `/api`, `/admin`. Deliberately no soft-gate on booking — respects the "browse-first, never block" line from §2. Prod path for the mobile app is now clearly documented in §11: same PWABuilder workflow with package ID `com.aforaudience.app` (reserved, not yet used) and a permanent signing key — Hitesh will run that separately when Razorpay live keys land and real Play Store submission is ready.

**Ninth amendment — Late 14 Jul 2026 session, evening/night continuation.** Four more PRs merged after the eighth amendment (#46 login/username fixes, #47–#49 support widget cluster, #50 assetlinks), taking the same day's total to ten. **(1) Login bug caught through real usage** and DB-verified before fixing: bare 10-digit phone numbers failed silently on login because the auth path did exact-string matching against phone values that were stored `+91`-prefixed. All 14 QA users were affected. Bundled username case-insensitivity in the same PR since it was a one-line touch of the same call site. **(2) Support widget cluster — a bounded FAQ chatbot + a feedback form + an admin review page — shipped as three sibling PRs.** The chatbot at `POST /api/chat` uses `claude-haiku-4-5-20251001`, is aggressively bounded: it answers **only** from `src/lib/site-knowledge.ts` (a hand-curated knowledge base of AforAudience-specific facts), is instructed to refuse anything off-topic, and specifically never invents refund or fee policy — those are still open business decisions (§9.5), not something a chatbot should hallucinate. The chat surface is admin-configurable via a new `PlatformSettings.chatMaxMessagesPerSession` (default 15, `0` = kill-switch so admin can disable the feature without a deploy if it misbehaves), enforced client-side and re-validated server-side. Chat access stays open to everyone (guest + authenticated) — an earlier suggestion to gate it to paid bookers was pushed back on, the admin-configurable session cap being the safer control surface than a paywall. `POST /api/feedback` is guest-accessible with an optional screenshot attachment stored as a base64 data URL directly in `Feedback.attachmentData` for MVP simplicity (client resizes to well under 1MB before encoding; migrate to Vercel Blob if attachments become heavily used — see 9.5-adjacent housekeeping). The admin review page at `/dashboard/admin/feedback` is a real page, not just an API — lists feedback, filters by status, marks resolved. **(3) Prompt-caching reverted mid-ship:** the installed `@anthropic-ai/sdk` types don't expose `cache_control` on the plain `messages.create()` shape used in this codebase, even though the API supports it. Shipped uncached (~₹0.30/turn vs. ~₹0.11 cached — still negligible against the platform's economics) with a source-code note to revisit if the SDK types catch up. **(4) `public/.well-known/assetlinks.json`** — the QA APK from the eighth amendment was showing an address bar on launch, and that bug was caught **through the newly-shipped feedback widget itself**, submitted by Hitesh. Fingerprint recorded, file served at the well-known path, browser Digital Asset Links verification now passes. Note that Android caches this verification aggressively — a full uninstall/reinstall is needed to re-verify on the same device. Prod path in §11 remains valid: add the prod fingerprint as a **second** entry in `assetlinks.json` when the prod APK is built, do not replace QA's.

**Tenth amendment — 15 Jul 2026 morning session.** Two PRs merged (#52 F6, #53 RLS), plus this doc update. **(1) F6 — VenueBooking rate snapshot fully wired.** The schema comment on `VenueBooking` (§4.5) had claimed since the fifth amendment that `agreedRateType`/`durationHours`/`durationDays`/`platformFeeAmount` were "snapshotted at confirmation time so later changes to the Venue's published rates don't retroactively alter a confirmed booking." Reading the actual confirm code path (`PATCH /api/venue-bookings/[id]`) turned up two real gaps: (a) the **actual rate values** (`Venue.hourlyRate`, `Venue.dailyRate`) were never snapshotted onto the booking, only the derived shape — so a Venue Owner editing their published rate today would retroactively shift the effective rate of every already-confirmed HOURLY/DAILY booking against that venue; and (b) even the four fields that *were* meant to be snapshotted were being silently left `null` on the PENDING → CONFIRMED transition, because the confirm handler was writing `{ status }` only. The QA data made the bug visible in real terms: three CONFIRMED bookings existed against real venues, and their `amount` fields didn't cleanly divide by the *current* venue rates (e.g. The Vintage Club at hourlyRate 1000 had a 2500 booking → 2.5 hrs, non-integer, meaning the venue rate has changed since confirmation and we now have no way to know what it was). Migration `20260715000000_venue_booking_rate_snapshot` added `snapshotHourlyRate` and `snapshotDailyRate` (both `Float?`, nullable and additive, no backfill — writing today's Venue rates onto historical bookings would fabricate history worse than leaving null). Confirm handler now snapshots rate + duration + rate type on the PENDING → CONFIRMED transition for HOURLY/DAILY venues, with an idempotence guard (`agreedRateType === null`) so flipping status back and forth doesn't overwrite the original capture. FLEXIBLE flow untouched — it goes through the `VenueBookingRequest` negotiation loop and already snapshots what applies there; there is no published rate for FLEXIBLE, `amount` IS the negotiated deal. §9.3 updated: F6 moves off the "backend ready, waiting on frontend" list — the frontend didn't need a change, the backend just wasn't finished. **(2) RLS on `Payment` and `Feedback` — deny-by-default.** Supabase's security advisor flagged both tables as RLS-disabled, meaning anyone holding the anon key could construct a Supabase client and read/modify every row (Razorpay IDs and amounts on `Payment`; guest bug reports and attached screenshots on `Feedback`). Access-pattern audit before deciding the shape: **zero uses of `@supabase/supabase-js` anywhere in `src/`** (verified via grep across `.ts` and `.tsx`), all reads/writes go through Prisma against `DATABASE_URL` → Session Pooler as the `postgres` role, which has `BYPASSRLS`. Given that: `ENABLE ROW LEVEL SECURITY` on both tables with **no policies** is the correct default — zero blast radius on the app (Prisma continues unchanged), while the entire anon/authenticated JWT read path against these tables is killed. `FORCE ROW LEVEL SECURITY` intentionally not applied (`FORCE` would subject the postgres role to RLS too, breaking Prisma). If a future feature ever needs client-side reads on these tables, a targeted `CREATE POLICY` scoped to the specific authenticated user should be added in that PR — not by loosening this deny-by-default. Both migrations applied to QA Supabase before the code deploys, verified via `information_schema` and `pg_class`. Prod Supabase is now two migrations behind QA; that gap closes on the next `qa → main` promotion.

**Eleventh amendment — 17 Jul 2026 session.** Three bug-fix PRs merged (#58 homepage marquee loop, #59 mobile events-filter/sort-dropdown misalignment, #60 server-side email format validation), plus doc cleanup. **(1) Marquee loop (#58):** homepage ticker array was 7 unique items followed by only the first 3 repeated (10 total, not a clean duplicate) — the `translateX(-50%)` keyframe only loops seamlessly when the two rendered halves are identical, so the mismatch caused a visible jump each cycle. Fixed by rendering the 7 unique items duplicated exactly once. A residual jank concern (raised, not confirmed) was parked as low-impact/no clear repro rather than chased further. **(2) Mobile filter-bar misalignment (#59):** the events-page filters row (type pills, city select, price pills, view toggle) had no responsive layout at all, unlike `SiteNav` which already has a 780px breakpoint — on narrow viewports the row wrapped unpredictably and a fixed-height divider floated misaligned against whatever wrapped next to it. Fixed with an explicit mobile layout at the same 780px breakpoint: column stack, divider hidden, select full-width. **(3) Server-side email validation (#60):** registration only checked email was non-empty and unique; format was client-side only (`<input type="email">`, bypassable via autofill/disabled-JS/direct API call). Two real QA users had malformed emails (`amolgokhe893gmail.com`, `amolgokhe.com`) live in the database, confirmed via direct query before fixing — not hypothetical. New `src/lib/validation.ts` with `isValidEmailFormat()`, wired into `POST /api/auth/register`. Scope-checked first: register is the only endpoint that writes a new email (`users/me` only reads it, `forgot-password` only looks one up, both harmless as-is). Already-malformed DB rows deliberately left untouched — a data decision, not folded into the fix. **(4) Phone-verification gap found, not fixed this session:** investigating #60 surfaced that neither password login nor either booking route checks `User.isVerified` — an account can skip phone-OTP entirely and still book/pay for a real ticket. A booking-gate fix was drafted and then deliberately reverted before shipping, because no UI exists for a user to complete phone verification after the immediate post-registration screen — shipping the gate alone would strand legitimate unverified users at checkout with no way out. Logged properly as backlog (§9.1 #1, §9.2) rather than rushed. Confirmed as a non-issue in the same investigation: email verification is already correctly non-blocking by design (`verify-email/route.ts` deliberately never touches `isVerified`), so no work needed there. **(5) Doc hygiene:** found and fixed stale status markers from the tenth amendment that never got updated when F6 shipped — the epics table (§6) still said "Not started", the backlog-order snapshot (§8.2) still listed F6 (and L5, also shipped in the eighth amendment) as remaining work, and §9.1's "next up" list still carried F6 and `assetlinks.json` as unblocked work despite both having shipped in the tenth and ninth amendments respectively.



## 1. Vision, Brand, Personas (carried forward, unchanged)

**Vision:** The first unified live-performance-art ecosystem — comedians, poets, musicians, dancers, organisers, venues, and audiences on one platform.
**Tagline:** "Where Art Finds Its Crowd"
**Differentiators:** Navarasa search (9 emotions of Indian classical art as an event filter — no competitor has this), a portable global Artist reputation layer (Hype Score, reviews, history), and a Venue OS.

| Role | Core Job To Be Done |
|---|---|
| Audience | Discover → attend → rate/tip |
| Artist | Get discovered, get booked, build reputation |
| Organiser | Run events end-to-end |
| Venue Owner | Monetize space, manage calendar |
| Admin | Approvals, trust, platform health |

Brand colors, typography, and design principles are unchanged from the original Design Document (§2) and apply identically to web and mobile.

---

## 2. The Access Model — Browse-First (New Standard, All Platforms)

### 2.1 Principle
**Discovery is the product. Login is a checkpoint, not a gate.** Anyone — logged in or not — browses events, artists, and venues immediately. Login is requested only at the moment an action requires identity.

### 2.2 Unified Flow (Web + Mobile)
```
Splash / Landing (brand only, <2s)
  → City Detection/Selection (no account)
  → Home — Guest Mode, full browsing
  → [Guest browses Events / Artists / Venues / Search / Navarasa filters freely]
  → Guest attempts a gated action
  → Contextual login prompt (bottom sheet on mobile / modal on web)
  → Phone OTP or Google/Apple one-tap (web: email/password + same social options)
  → Resumes exact action — no redirect to Home
```

No role picker at signup. **Audience is the default identity for everyone.** Artist / Organiser / Venue Owner become **opt-in upgrades** from Profile → "Become an Organiser / Apply as Artist / List Your Venue," each routed through its own lightweight application + admin approval flow (unchanged from Design Doc §4.5).

### 2.3 Gated Actions (applies to both platforms)
Book ticket · Follow artist · Tip artist · Rate/review · Save/wishlist · View My Tickets · Post an event · Apply as Artist/Organiser/Venue.

### 2.4 What This Replaces
- **Mobile Design Doc:** delete "Role Selection Screen" (§5.3) and the Role Selection step in the Onboarding Flow (§4) and Figma checklist. Auth screens (`login.tsx`, `register.tsx`, `otp.tsx`) remain but are invoked contextually, not as a forced first-run sequence.
- **Web Design Doc:** `/register` no longer collects a role at signup. Role selection UI and its associated test cases (2.1–2.4, 2.12 in the QA plan) are retired in favor of the opt-in upgrade flow.

---

## 3. Open Product Decisions — Resolved This Chapter

The QA test plan flagged five undocumented decisions. Ruling on each so stories/estimates aren't blocked:

| Decision | Ruling |
|---|---|
| Forgot/reset password | **In scope for MVP.** Email-based reset link, 1-hour token expiry. New epic (see EPIC-B). |
| Email verification (`isVerified`) | **Soft-gate.** Unverified users can browse and book (guest-equivalent), but cannot post events, apply as Artist, or receive payouts until verified. |
| Pending Organiser/Venue Owner login | **Login succeeds**, dashboard shows a "Pending Approval" banner/state instead of full functionality (matches QA case 5.4's better-UX branch). |
| Rate limiting / lockout | **In scope.** 5 failed attempts → 15-minute lockout per account, generic error message (no enumeration). |
| Session/token policy | **Web:** NextAuth JWT, 7-day expiry, refresh on activity. **Mobile:** SecureStore JWT, 30-day expiry, biometric re-auth optional (matches Mobile doc §12 already). |
| Auto-approval floor for performer applications | **Require `isVerified`** on the applying Artist account. No Hype Score threshold for now. |
| Commission on venue rental | **None. Ever.** Venue rental is entirely between Venue Owner and Organiser; platform takes zero from it. Reversed from second amendment per fifth amendment. |
| Commission on performer slots (`PAID` / `BUY_IN`) | **None. Ever.** Performer compensation is entirely between Organiser and Artist; platform takes zero from either direction. Reversed from second amendment per fifth amendment. |
| Commission on ticket sales | **None.** Platform does not take a percentage of the ticket price. See "Platform revenue model" below. |
| Platform revenue model | **Audience-side booking fee only for MVP** — a small flat fee (e.g., ₹10–15) added to each ticket at checkout, framed transparently as "supports the artist ecosystem." No supply-side charges. Post-MVP revenue arrives in phases per §4.5: optional Pro tiers for Venues/Organisers, featured placements, then livestream / digital merch cuts on features the platform uniquely provides. The core artist ↔ organiser ↔ venue ↔ audience transaction remains untaxed forever. |

---

## 4. Consolidated Feature Set by Phase

Reconciling the Design Doc roadmap (§15) with the Mobile doc's phases into one backlog view:

| Phase | Web | Mobile | Notes |
|---|---|---|---|
| **MVP (P1)** | Guest browse, contextual auth, booking, Razorpay, PDF tickets, notifications | Guest browse, contextual auth, booking, Razorpay, My Tickets | Mobile launches with web feature parity first — no exclusive features yet |
| **P2 — Growth** | Venue OS, Admin panel, reviews, Navarasa search, Art Passport | Same + push notifications, dashboards | |
| **P3 — Intelligence** | AI Matchmaker, mood search, livestream, tip wallet, payouts | Tip Artist, Reels tab, Backstage Pass | |
| **P4 — Scale / Exclusive** | NFT tickets, digital merch, multi-city | Shake to Discover, AR Venue Preview, QR check-in, Live Reactions, Pre-show Chat, offline tickets, Wallet integration | App-exclusive features deliberately land *after* core parity, matching Mobile doc §13 phasing |

---

## 4.5 Economics Model — Rewritten Per the About Page Promise

**Governing principle (from the About page, verbatim):** *"We will never tax the scene. Not the venue owner. Not the organiser. Not the artist. Not the rental between a venue and an organiser. Not the fee an organiser pays a performer. None of it."*

Every design decision in this section flows from that. Where the old §4.5 asked "how do we tax which flow," this §4.5 asks "how do we sustain a real business without taxing any of them."

### The three money flows on the platform (who pays whom)

There are three distinct money flows around a live event, and each stays entirely between its participants — the platform is inside exactly one of them, on the audience side.

**Flow 1 — Venue rental (Venue Owner ↔ Organiser).** The Venue Owner sets how their space is rented (Hourly, Daily, or Flexible-quote). The Organiser pays that amount directly to the Venue Owner. **Platform takes zero.** The rate model, the negotiation flow, the confirmed-booking-required-before-publish rule — all preserved from the old §4.5. Only what's removed: any "platform fee added on top."

**Flow 2 — Performer compensation (Organiser ↔ Artist).** For each lineup slot, the Organiser marks it `PAID` (Organiser owes the Artist a fee), `FREE` (exposure/open-mic, no money either way), or `BUY_IN` (Artist pays Organiser a spot fee — common pay-to-play open-mic model). **Platform takes zero from either direction.** This compensation is settled between Organiser and Artist off-platform for MVP (the way it already is today in the scene — WhatsApp/UPI/cash). The platform records the *promise* (compensation type and amount, so both sides have a clear record), but does not process the payment or take a cut. A future release may offer optional in-app payment facilitation as a convenience — and even then, still with zero platform fee.

**Flow 3 — Ticket sales (Audience → Organiser).** The audience buys tickets; the money goes to the Organiser (minus the small audience-side booking fee described below). **Platform takes zero commission on the ticket price itself.** The Organiser sets per-section ticket pricing exactly as before (via `TicketTier`). This is the only flow the platform is in the middle of, and the only one that has any platform charge — and that charge is on the *audience*, not the Organiser, framed transparently.

### Where platform revenue comes from — phased introduction

Aligned to the About page's promise "we will earn our right to charge before we charge." Rough sequencing keyed to platform maturity and runway (not calendar months):

**Phase A — MVP (from Day One):**
- **Audience booking fee** — a small flat fee (e.g., ₹10–15) added to each ticket at checkout. Shown as a separate line item; framed as *"supports the artist ecosystem — keeps the platform free for artists and venues."* Uses the ticket-processing pipeline (Razorpay Route or similar) so the fee is captured before the rest of the ticket amount is passed through to the Organiser. **Checkpoint 4 is complete (sixth amendment).** Ships at ₹0 by default; admin flips it on at `/dashboard/admin/settings`. Ceiling ₹500 (50000 paise) enforced in setter as a typo-guard.
- **Optional "support the platform" tip at checkout** — a small opt-in "buy the platform a coffee" widget with a couple of preset amounts. Zero pressure, but historically works better than founders expect.
- Everything else free.

**Phase B — After real supply-side traction (once venues/organisers are actively using the platform and asking for more):**
- **Venue Pro** — monthly subscription for advanced features Venue Owners have actually asked for (calendar sync, analytics, priority search, verified badge, etc.). Free tier stays fully functional; Pro is genuinely more, not free-with-crippling.
- **Featured event/venue/artist placements** — small pay-to-promote slots with clear guardrails around search integrity.

**Phase C — After Venue Pro is proven:**
- **Organiser Pro** — subscription for real-time sales dashboards, lineup builder, audience insights, AI matchmaker access.
- **Artist Premium** — small subscription for Rising Star rotation, verified badge, application boost. Free artist profiles remain first-class.
- **Verified badges, priority approval, white-label event branding** — small one-time value-added services.

**Phase D — After the platform has built genuinely new capability:**
- **Livestream revenue share (~15%)** on the pay-per-view livestream feature — platform built the streaming infrastructure, so a share of the revenue *from that specific feature* is earned. This does not violate the "never tax the scene" promise because the platform is providing entirely new value the scene didn't have before, not taxing a transaction that already existed.
- **Digital merch marketplace cut (~10%)** — same reasoning; platform-built marketplace, platform earns a cut on merch it uniquely enables.
- **Small ticket platform fee** may be considered here (2–3%), transparently framed, only after the platform is delivering enough scale-level value to defend it. **This is a "maybe later" — the default is to never introduce it and stay funded by Phases A–C indefinitely.**

The whole point of the phased plan: every revenue stream is either (a) on the audience side (booking fee, tip), (b) optional Pro subscriptions the supply side actively wants and pays for voluntarily, or (c) tied to features the platform *uniquely provides* (livestream, merch). No stream ever taxes the core artist ↔ organiser ↔ venue ↔ audience transaction. That promise is permanent.

### Data model — what stays, what dies, what's new

**Stays (from prior §4.5, still fully valid):**
- `Venue.rateType` (`HOURLY` | `DAILY` | `FLEXIBLE`), `hourlyRate`, `dailyRate`, `minDurationHours` — Venue Owner rate model unchanged.
- `VenueBooking.agreedRateType`, `agreedAmount`, `durationHours` / `durationDays` — negotiated rental terms snapshotted on each confirmed booking.
- `VenueBookingRequest` and `VenueBookingOffer` — the Flexible negotiation loop with counter-offers.
- `TicketTier` — per-section ticket pricing on events.
- `Event.maxSeatsPerBooking` (default 4, platform-bounded 1–10) — anti-abuse cap, not economics.
- `Event.maxPerformers` and `applicationApprovalMode` (`MANUAL` | `AUTO`) — Organiser's lineup controls.
- `Performance.compensationType` (`PAID` | `FREE` | `BUY_IN`), `feeAmount`, `buyInAmount` — reinterpreted as **records of the promise between Organiser and Artist**, not as amounts the platform will process. Kept because they're still meaningful UX and coordination signals: the Artist can see up front whether a slot pays, the Organiser has a record of what was agreed, and both sides can dispute against a shared record.

**Dies (dead columns; marked `@deprecated` in schema, do not read from application code):**
- `VenueBooking.platformFeeAmount` — no more flat fee added on top of venue rental. Column stays for existing rows' historical accuracy; new bookings write `0` or `null`.
- `PlatformSettings.ticketCommissionRate` — no more ticket commission. Dead column.
- `PlatformSettings.performerSlotCommissionRate` — no more slot commission. Dead column.
- `PlatformSettings.flatVenueBookingFee` — retired name. `audienceBookingFee` was added as a **new** column (not a rename), per sixth amendment implementation choice.
- `Payment.deliveredAt`, `Payment.deliveryError` — source of truth moved to `Booking.deliveredAt`/`Booking.deliveryError` per seventh amendment. Historical rows preserved; new writes go to Booking.

**New (from Checkpoints 2–4 and seventh amendment):**
- `PlatformSettings.audienceBookingFee` — Int paise, used by K1. Consistency with `Payment.amount` (also Int paise).
- `Booking.subtotalAmount`, `Booking.bookingFeeAmount`, `Booking.totalAmount` — all Float rupees, for compatibility with pre-existing `Booking.totalAmount`. Snapshotted at reservation.
- `Booking.deliveredAt`, `Booking.deliveryError` — atomic single-flight claim for ticket delivery. Works for both paid and free events (Payment-based claim didn't).
- `Payment` (from Checkpoint 2) — one per Booking, `amount` in paise as Int, tracks `razorpayOrderId`/`razorpayPaymentId`, `status` enum (`CREATED` → `VERIFIED` / `WEBHOOK_CONFIRMED` / `FAILED`).
- `User.displayName` (from Fix B / EPIC L) — separate from `User.name` (which is the login username). Tickets, emails, greetings use `displayName ?? name`.
- (Optional, Phase B onward) `Subscription` model for Venue Pro / Organiser Pro / Artist Premium — `{ userId, tier, status, currentPeriodEnd, ... }`. Not needed for MVP.

### Fee snapshotting (sixth amendment implementation detail)

The audience booking fee is captured onto Booking at reservation time. If admin changes the fee while a PENDING booking is open, that booking pays the original fee, not the new one. This is intentional — prevents fee-changes mid-flight from surprising an audience member.

### The old collaborator suggestions — which are still live, which are moot

1. **"Don't let an event go public without a confirmed venue booking."** — Still live, still the rule. Already shipped.
2. **"`FLEXIBLE` needs a real negotiation flow."** — Still live. Already shipped (F5/F7/E10/E12).
3. **Auto-approval requires `isVerified`.** — Still live. Already shipped.
4. ~~**"Commission math needs to be explicit."**~~ — Moot. No commission.
5. ~~**"Performer fee payout mechanics need to be settled through platform."**~~ — Moot. Platform doesn't process performer fees at MVP.
6. **"`BUY_IN` needs a collection point and cancellation rule."** — Still live *if* the platform ever offers optional payment facilitation (Phase D or later). Not urgent for MVP; performer pays Organiser directly.
7. **"Counter-offer loop needs a cap and expiry."** — Still live, still the right call. Already shipped.
8. **"Max-seats-per-booking should be Organiser-configurable but platform-bounded."** — Still live. Already shipped (E13).
9. ~~**"Organiser guarantee deposit for promised `PAID` fees."**~~ — Moot. Platform isn't in that money flow, so there's nothing to guarantee against. If the Organiser doesn't pay their performer, that's between them; platform doesn't owe anyone anything.

### Note on Razorpay dependency

The audience booking fee (Phase A) requires the ticket-processing pipeline to be live. **Test-mode keys unblocked the entire build** — Checkpoints 2–4 all shipped against them. When the company clears KYC and live keys are swapped in on production, the audience booking fee begins collecting real money immediately.

Split-payment mechanics (audience booking fee to platform, remainder to Organiser) can be handled through Razorpay Route on the platform's own account. This is a marketplace pattern Razorpay explicitly supports and keeps the platform out of Payment Aggregator license territory — the platform is the merchant of record only for the booking-fee slice, and Organisers are the merchants of record for their ticket revenue. **K2 (Razorpay Route split) is deferred until real Organiser onboarding lands as a real feature** — until Organisers have Razorpay-linked accounts of their own, all Checkpoint 4 revenue currently settles into the platform's Razorpay account, with the "remainder to Organiser" mechanic pending.

---

## 5. Architecture Summary (unchanged, restated for reference)

- **Shared backend:** Next.js API routes on Vercel, Prisma v7 → Supabase Postgres, NextAuth.js, Razorpay, Resend (email), MSG91 (SMS). Both web and mobile hit the same API.
- **Web:** Next.js 16, TypeScript, Tailwind, shadcn/ui, Zustand.
- **Mobile:** React Native 0.74+ / Expo SDK 51+, Expo Router, Zustand + React Query, NativeWind, Expo SecureStore for tokens. *(Release 3 target — not started as of seventh amendment.)*
- **Realtime:** Supabase Realtime for seat locking, live reactions, pre-show chat.

Data model, enums, and API routes are as specified in Design Doc §9–10 and Mobile Doc Appendix A, with three sets of changes layered on:
- Browse-first: registration no longer requires `role` at submit time (defaults to `AUDIENCE` server-side).
- Auth hardening: new `PasswordResetToken` model (§3's reset-password decision).
- Venue & event economics (§4.5): `Venue.rateType`/`hourlyRate`/`dailyRate`, `VenueBooking.agreedRateType`/`agreedAmount`/duration, new `TicketTier` model replacing flat `Event.ticketPrice`, and `Performance.compensationType`/`feeAmount` plus `Event.maxPerformers`/`applicationApprovalMode`.
- Payment & delivery (sixth/seventh amendments): `Payment` model, `Booking.deliveredAt`/`deliveryError`, `Booking.subtotalAmount`/`bookingFeeAmount`.

---

## 6. Epics & User Stories

Story points use Fibonacci (1, 2, 3, 5, 8, 13). Estimates assume a solo developer pairing with Claude for design/code/review — they size relative effort, not calendar time.

### EPIC A — Guest Browsing & Discovery
| ID | Story | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|
| A1 | As a guest, I can see Home (Tonight/Trending) without logging in | Home loads with no auth check; "For You" degrades to city+trending | 3 | ✅ Verified |
| A2 | As a guest, I can browse Events with full filters | City/date/price/type/Navarasa filters all functional logged-out | 3 | ✅ Verified |
| A3 | As a guest, I can view full Event detail (lineup, reviews, venue) | No content is hidden or blurred for guests | 2 | ✅ Verified |
| A4 | As a guest, I can view Artist and Venue profiles fully | Same as A3 | 2 | ✅ Verified — no auth check anywhere in code |
| A5 | As a guest, I can search | Search works with no session | 2 | ⬜ N/A — no standalone search feature exists yet, only in-page filters on Events/Artists listings (already confirmed open) |

### EPIC B — Contextual Auth
| ID | Story | Acceptance Criteria | Pts | Status |
|---|---|---|---|---|
| B1 | As a guest, tapping a gated action shows a contextual bottom sheet/modal, not a redirect | Sheet copy references the specific action just taken | 5 | ✅ Shipped |
| B2 | As a user, after completing login I resume exactly where I was | Booking resumes at seat selection, not Home | 8 | ✅ Shipped — resumes the exact seat selection after sign-in, no lost context |
| B3 | As a user, I can register via phone OTP (mobile) or email/password (web) with no role picker | Account created with role=AUDIENCE by default | 5 | ✅ Shipped |
| B4 | As a user, I can sign in with Google/Apple one-tap | Social auth creates/links account correctly | 5 | ⬜ Not started — needs OAuth app registration in Google/Apple consoles first |
| B5 | As a user, I can request a password reset (web) | Reset email sent, link expires in 1hr, old password invalidated on use | 5 | ✅ Shipped |
| B6 | As the system, I lock an account after 5 failed logins for 15 minutes | Generic error shown; no user enumeration (ties to QA 3.2/3.3) | 3 | ✅ Shipped |
| B7 | As a pending Organiser/Venue Owner, I can log in and see a Pending Approval state | Dashboard shows banner, not full features (resolves QA 5.4) | 3 | ✅ Shipped — verified live with a real account |

### EPIC C — Booking & Payments
| ID | Story | Pts | Status |
|---|---|---|---|
| C1 | As audience, I can select seats on an interactive map with live lock (no double-booking), limited to the event's configured max-seats-per-booking across all sections combined | 8 | ✅ Shipped (sixth amendment) |
| C2 | As audience, I can pay via Razorpay (UPI/card/wallet) | 5 | ✅ Shipped (Checkpoint 2 / sixth amendment) — HMAC-verified confirm + server-to-server webhook, browser-death race handled |
| C3 | As audience, I receive PDF ticket + SMS + email instantly on confirm | 5 | ✅ Shipped (Checkpoint 3 / sixth amendment) — PDF via pdf-lib with QR encoding booking ID, Resend delivery from `tickets@mail.aforaudience.com`; **SMS still deferred** on MSG91 DLT registration. Free events now included (M1, seventh amendment). |
| C4 | As audience, I can view My Tickets (gated — triggers login if guest) | 3 | ✅ Shipped — `/tickets`, honest about reservation vs. confirmed status |
| C5 | As audience, I can cancel a booking and see refund status | 5 | ⚠️ Partial — cancel works (releases seats immediately); refund half is Checkpoint 5, not started (needs business decisions before build — see §9.5) |

### EPIC D — Artist Growth
| ID | Story | Pts | Status |
|---|---|---|---|
| D1 | As an artist, I can apply to upgrade from Audience via Profile | 3 | ✅ Shipped — no approval gate, unlike Organiser/Venue Owner; homepage's "I'm an Artist" CTAs now actually lead here instead of plain registration |
| D2 | As an artist, I can build a profile (bio, style tags, reel, socials) | 5 | ⬜ Not started — Artist dashboard exists (pre-existing) but the full profile-editing surface (reel, socials) isn't confirmed complete |
| D3 | As an artist, I can apply for open event slots and see application status | 5 | ✅ Shipped (pre-existing, predates this doc) |
| D4 | As an artist, I can view my Hype Score and post-show report | 5 | ⬜ Not started — Hype Score field exists (defaults 0), no growth/report UI |

### EPIC E — Organiser Tools
| ID | Story | Pts | Status |
|---|---|---|---|
| E1 | As a user, I can apply to become an Organiser via Profile | 3 | ✅ Shipped — verified live |
| E2 | As an approved Organiser, I can create an event via a guided wizard | 8 | ✅ Shipped (pre-existing, predates this doc) |
| E3 | As an Organiser, I can build a lineup (drag/drop, time blocks) | 8 | ✅ Shipped (eighteenth amendment) — `/dashboard/organiser/events/[id]/lineup`. Touch-compatible drag reorder via `@dnd-kit` (new dependency — no drag library existed, native HTML5 DnD doesn't work on touch), per-slot duration input, computed start/end time blocks (derived from `event.startTime` + cumulative duration, not stored). |
| E4 | As an Organiser, I can approve/reject Artist applications | 3 | ✅ Shipped — confirmed directly in code; was mislabeled not-started in earlier passes of this doc |
| E5 | As an Organiser, I can view real-time ticket sales | 5 | ✅ Shipped (fifteenth amendment — per-event dashboard; sixteenth — organiser overview + range filters; seventeenth — venue owner overview + organiser breakdown). Per-event: polling dashboard (20s), per-tier sold counts, revenue split, sales timeline, recent bookings. Organiser overview (`/dashboard/organiser/sales`) and Venue Owner overview (`/dashboard/venue/sales`) both have Week/Month/Quarter/Year/All Time range filters and drill-down into their respective per-entity pages. |
| E6 | As an Organiser, I can set/edit ticket price independently per seat section, matching the venue's seat map zones | 5 | ✅ Shipped |
| E7 | As an Organiser, I can mark each lineup slot as Paid (Organiser owes the Artist a fee, settled between them off-platform for MVP), Free (no money either way), or Buy-in (the Artist pays the Organiser a spot fee, e.g. ₹200 — also settled between them off-platform for MVP). Platform records the promise for both sides' clarity but does not process the payment or take a cut. | 8 | ✅ Shipped — compensation choice happens at application-approval time. The stored `feeAmount` and `buyInAmount` fields are records of the between-parties promise. |
| E8 | As an Organiser, I can set a maximum number of performers for an event/slot | 2 | ✅ Shipped — enforced on both auto- and manual-approval paths |
| E9 | As an Organiser, I can toggle whether Artist applications require my manual approval or auto-accept up to the performer cap (auto-accept requires the applying Artist to be verified) | 5 | ✅ Shipped — Auto mode can only default to Free compensation (no per-applicant input at apply time); Organiser can adjust after the fact |
| E10 | As an Organiser, I can request a venue booking under Hourly, Daily, or Flexible terms, and — for Flexible — send a duration/date request and receive a quote back from the Venue Owner before confirming | 8 | ✅ Shipped |
| E11 | *(Retired per fifth amendment — no longer in MVP.)* Buy-in is now settled between Organiser and Artist off-platform. | — | ⬜ Retired |
| E12 | As an Organiser, when a Venue Owner quotes me on a Flexible request, I can accept, decline, or send back a counter-offer, up to 3 rounds before the request auto-expires | 5 | ✅ Shipped |
| E13 | As an Organiser, I can set a max-seats-per-booking limit for my event (default 4, platform-bounded 1–10), enforced across all sections combined in a single booking | 3 | ✅ Shipped |
| E14 | *(Retired per fifth amendment.)* Platform fee on venue bookings removed. E14 cleanup ended up moot: the old `platformFeeAmount` UI on `VenueBooking` was never displayed anywhere in the shipped codebase (verified sixth amendment), so no cleanup was actually needed. | — | ⬜ Retired |

### EPIC F — Venue Owner Tools
| ID | Story | Pts | Status |
|---|---|---|---|
| F1 | As a Venue Owner, I can create a venue profile with seat map | 8 | ✅ Shipped (pre-existing, predates this doc) |
| F2 | As a Venue Owner, I can set availability and pricing per zone | 5 | ✅ Shipped (pre-existing) |
| F3 | As a Venue Owner, I can view booking calendar and revenue | 5 | ✅ Shipped — revenue cards (this month/total/pending) + a lightweight custom month calendar, built into the existing bookings page |
| F4 | As a Venue Owner, I can choose a rental rate type — Hourly, Daily, or Flexible — for my venue and set the base rate(s) for it | 5 | ✅ Shipped — including optional day-of-week overrides, verified live |
| F5 | As a Venue Owner, I can review an Organiser's Flexible booking request and respond by accepting, declining, or sending a counter-offer amount | 5 | ✅ Shipped |
| F6 | As a Venue Owner, I can see the agreed rate/duration snapshotted on each confirmed VenueBooking, unaffected by later changes to my published rates | 3 | ✅ Shipped (tenth amendment) |
| F7 | As a Venue Owner, when an Organiser counters my quote, I see their new number alongside the full offer history and can accept, decline, or counter again | 5 | ✅ Shipped |

### EPIC G — Reviews, Tips, Follow
| ID | Story | Pts | Status |
|---|---|---|---|
| G1 | As audience, I can follow an artist (gated) | 2 | ✅ Shipped. Nineteenth amendment: follower list + count now visible on the Artist dashboard (was previously invisible even though the data existed — the new-follower push linked to a page with nothing on it), and a push notification fires on new follow (not unfollow). |
| G2 | As audience, I can rate/review a performer post-show (gated) | 3 | ✅ Shipped. Nineteenth amendment: now actually gated on attendance — requires a `CONFIRMED` booking with `checkedInAt` set (EPIC N's check-in system made this buildable; the original "not restricted to attendees" limitation is closed). Server-side only — the review widget's UI still renders unconditionally, see EPIC J follow-ups. |
| G3 | As audience, I can tip an artist directly, 100% passthrough (gated) | 5 | ⬜ Not started — Razorpay is now live in QA (sixth amendment), so the technical blocker is gone; ship when it fits priority. Feedback also asks for the reverse view (artist seeing who tipped them) — same story. |

### EPIC H — Admin & Trust
| ID | Story | Pts | Status |
|---|---|---|---|
| H1 | As Admin, I can approve/reject Organiser and Venue Owner applications | 5 | ✅ Shipped — verified live |
| H2 | As Admin, I can view a dashboard of pending approvals | 3 | ✅ Shipped — verified live |
| H3 | As Admin, I can flag/suspend suspicious accounts | 5 | ⬜ Not started |
| H4 | As Admin, I can configure the audience-side booking fee from a settings screen. | 2 | ✅ Shipped alongside Checkpoint 4 (K1). `/dashboard/admin/settings`. Dead columns from fifth amendment are correctly not surfaced. |

### EPIC I — Mobile-Exclusive (Phase 4)
Shake to Discover (5), QR Check-in (5), Offline tickets (5), AR Venue Preview (13), Live Reaction Feed (8), Pre-Show Chat (5), Add to Wallet (5).

### EPIC J — Notifications (rewritten nineteenth amendment — shipped this session)

Web Push (not SMS/email) is now the primary channel. VAPID-based, works on any installed PWA or browser tab with permission granted — no native app required. SMS remains blocked on MSG91 DLT registration; email stays ticket-delivery-only, unchanged.

**Infrastructure:**
| Piece | Detail |
|---|---|
| `PushSubscription` model | Keyed to `userId`, unique on `endpoint`. Upsert-safe — re-subscribing (new device, or an already-granted device switching to a different logged-in account) reassigns the row rather than erroring or duplicating. |
| `src/lib/push.ts` | `sendPushToUser` / `sendPushToRole`, no-ops with a warning if VAPID env vars aren't set. `notifyAfterResponse(fn, label)` wraps every call site — see the `after()` note below, this is not optional plumbing. |
| `/api/push/subscribe` | POST upsert, DELETE scoped to the caller's own endpoint only. |
| `sw.js` | `push` + `notificationclick` handlers — focuses an existing tab if one's open, else opens a new one at the notification's target URL. |
| `NotificationOptIn.tsx` | Dismissible opt-in banner (any logged-in role, not gated to one). Also handles the "device already granted permission under a different account" case silently — re-links or creates a subscription for whoever's currently logged in without a re-prompt, since the browser already decided. |

**Two engineering bugs found live-testing, both fixed — worth remembering for any future background-work pattern in this codebase:**
1. **Vercel can freeze a serverless function's runtime the instant its response is sent**, silently killing any bare un-awaited `promise.catch(...)` fire-and-forget call before it completes — no error, no log, it just never finishes. Confirmed happening: a push worked twice, then silently dropped a third time with zero trace anywhere. Fix: Next.js `after()` (15.1+) wraps every push send and every `deliverTicket()` call site now — runs after the response, but guarantees completion. `sendPushToRole`/`sendPushToUser` calls must go through `notifyAfterResponse()`, never called bare with `.catch()`.
2. **Default push urgency ('normal') lets Android's Doze/battery optimization defer delivery** by minutes on an idle device — confirmed live (a sales-milestone push arrived several minutes late, not dropped). Fixed via `options.urgency: 'high'` in `sendPushToUser` — note `@types/web-push`'s `RequestOptions` doesn't declare this field even though the runtime supports it (checked `node_modules/web-push/src` directly), hence a local type augmentation rather than fighting the incomplete types package. TTL also set to 1 hour (was the library default of 4 weeks) — a stale approval/negotiation notification surfacing hours later isn't useful for this app's notification types.

**Notification matrix (all confirmed working live, in this order of build):**
| Notify | Trigger |
|---|---|
| Admin | New Organiser/VenueOwner application |
| Organiser/VenueOwner applicant | Admin's approve/reject decision |
| Organiser | New artist application (manual-review events only — auto-approved events notify the Artist instead, since there's nothing for the Organiser to act on) |
| Artist | Application approved/rejected, or auto-approved |
| VenueOwner | New venue booking request (both the Flexible-negotiation and direct-booking paths) |
| Organiser/VenueOwner | Other side accepted/declined/countered in a negotiation (turn-based — whoever didn't just act gets pushed) |
| Artist | New performer-specific review |
| Organiser | New general event review (no `Review`→`Venue` link exists in the schema, so VenueOwners aren't reachable from a review yet) |
| Organiser | Ticket sale milestone — first sale / 50% / sold out (never per-ticket, would spam a popular event; only the single highest threshold a given booking crosses fires) |
| Artist | New follower |

**Deliberately not built (flagged, not silently skipped):**
- 48h negotiation-expiry notification — needs a cron job; no scheduled-task infra exists in this codebase yet (no `vercel.json`, no cron routes). Separate scope/decision.
- Audience "booking confirmed" push — redundant with the existing ticket email/PDF.
- Review widget's client-side gating — ~~the check-in requirement (see EPIC N amendment below) is enforced server-side only; the review UI on the event detail page still renders the rating widget unconditionally~~ ✅ **Fixed (PR #111, 19 Jul).** `events/[id]/page.tsx` (server component, already `force-dynamic`) now looks up the session and queries for a checked-in `CONFIRMED` booking, passing `canReview: boolean` down to the client component, which gates the widget on it (in addition to the existing "already reviewed" check). Anonymous viewers always get `canReview: false`; they see the widget on next load if they sign in and are actually checked in.
- Android `.apk`/TWA-specific notification checks — `POST_NOTIFICATIONS` runtime permission (Android 13+) and notification delegation (`enableNotificationDelegation`) live in the PWABuilder/Bubblewrap-generated Android project, not this repo. Confirmed conceptually works the same way (same Chrome engine, same service worker) but not verified against the actual QA `.apk`.

### EPIC K — Platform Revenue (per fifth amendment / About page)
| ID | Story | Pts | Status |
|---|---|---|---|
| K1 | As audience, when I check out for a ticket, I see a small booking fee as a separate line item on the order, framed as "supports the artist ecosystem." | 3 | ✅ Shipped (Checkpoint 4 / sixth amendment) |
| K2 | As the platform, at Razorpay settlement time, the audience booking fee is captured by the platform's own merchant account and the remainder is passed through to the Organiser — via Razorpay Route split. | 5 | ⚠️ Partial — fee captured to platform's Razorpay account; Route split deferred until real Organiser onboarding lands (Organisers need their own Razorpay-linked accounts first) |
| K3 | As audience, at checkout I optionally see a small "support the platform" widget with preset tip amounts — zero pressure, easy to skip. | 3 | ⬜ Not started |
| K4 | As Admin, I can view total booking fees collected, per day / month, from a simple revenue dashboard. | 3 | ⬜ Not started (though `/dashboard/admin/settings` exists for the config surface) |
| K5 | *(Phase B)* Venue Pro subscription. | 8 | ⬜ Not started — deliberately Phase B |
| K6 | *(Phase C)* Organiser Pro subscription. | 8 | ⬜ Not started — deliberately Phase C |
| K7 | *(Phase C)* Artist Premium subscription. | 5 | ⬜ Not started — deliberately Phase C |
| K8 | *(Phase B)* Promoted placement slots. | 5 | ⬜ Not started — deliberately Phase B |

### EPIC L — User Display Name (retrospective, sixth amendment)
Retrospective epic to record Fix B work.

| ID | Story | Status |
|---|---|---|
| L1 | User has separate `displayName` from login `name` (username) | ✅ Shipped |
| L2 | Register form's Full Name persists as displayName | ✅ Shipped |
| L3 | Profile page lets existing users set/edit displayName | ✅ Shipped |
| L4 | Tickets/emails/greetings use displayName-with-fallback-to-name | ✅ Shipped |
| L5 | Backfill hint / one-time nudge for null-displayName users | ✅ Shipped (eighth amendment, PR #44) — sticky top banner, dismissible for 14 days, self-hides on auth/checkout/api/admin |

### EPIC M — Free-Event Ticket Delivery (retrospective, sixth/seventh amendments)

| ID | Story | Pts | Status |
|---|---|---|---|
| M1 | Free events get PDF + email on auto-confirmation (delivery claim moved from Payment to Booking) | 3 | ✅ Shipped (seventh amendment) |

### EPIC N — Check-In / Scan Flow (twelfth amendment)

Real gap found in review, not hypothetical: the ticket PDF's QR has always encoded the raw `booking.id` (see comment in `src/lib/ticket-pdf.ts`), but until now nothing validated it or marked a ticket used - any booking, confirmed or not, could be "let in" indefinitely and repeatedly by anyone holding the QR image or just the printed Booking ID text.

| ID | Story | Status |
|---|---|---|
| N1 | `Booking.checkedInAt` / `checkedInByUserId` - once-only used-state, audit trail of who scanned | ✅ Shipped |
| N2 | `POST /api/events/[id]/checkin` - validates event match, `CONFIRMED` status, not-already-used; Organiser (owner) or Admin only | ✅ Shipped |
| N3 | `GET /api/events/[id]/checkin` - live checked-in/total counts for the scanner header | ✅ Shipped |
| N4 | Scanner UI (`/dashboard/organiser/events/[id]/checkin`) - camera QR scan (`html5-qrcode`) + manual booking-ID entry fallback, pass/fail card with attendee name + section | ✅ Shipped |

**Deliberately deferred:** the QR payload itself is still unsigned (just the raw booking ID) - anti-forgery lives entirely at scan time via the DB lookup/single-use check above, not at PDF-generation time. Signing/tokenizing the QR payload is a smaller follow-up, not blocking, since a forged code still has to guess a real unused `cuid` to do anything.

---

## 7. Key Use Cases (Detailed Flows)

**UC-1: Guest discovers and books a ticket (the flagship flow)**
1. Guest opens app/site → Home loads instantly, no auth.
2. Selects city, browses events, filters by Navarasa/mood, opens Event → sees lineup, venue, reviews.
3. Taps **Book Now** → contextual sheet: "Sign in to save your seat" → phone OTP.
4. Returns to seat selection → picks seat → Razorpay → PDF/SMS/email confirmation.

**UC-2: Audience upgrades to Organiser**
1. From Profile → "Become an Organiser" → application form (org name, city, phone).
2. Submits → application enters Admin queue.
3. Account flagged `isApproved: false`; user sees "Pending Approval" state if they visit a dashboard.
4. Admin reviews in Admin panel → approves.
5. User notified → dashboard unlocks full Organiser functionality.

**UC-3: Organiser creates an event, Artist applies, Audience books**
1. Approved Organiser → Create Event wizard → sets theme, type, date, searches Venue OS for a space.
2. Organiser requests the venue: if it's listed Hourly/Daily, books directly at the published rate; if Flexible, sends a duration/date request.
3. (Flexible only) Venue Owner responds with a quote → Organiser accepts → `VenueBooking` moves to `CONFIRMED` with the agreed rate/duration snapshotted.
4. Organiser sets ticket prices per section (matching the venue's seat map zones), marks each lineup slot Paid (with fee) or Free, sets max performer count, and picks Manual or Auto approval for applications.
5. Event goes to `PENDING_APPROVAL` — **cannot advance without a `CONFIRMED` VenueBooking** — Admin approves → status `APPROVED`, now publicly visible.
6. Artist (browsing Events tab) sees an open lineup slot with its fee/free status → applies.
7. If Manual: Organiser reviews and approves. If Auto: the application auto-accepts as soon as the Artist's account is verified and a slot is open.
8. Audience discovers event (as in UC-1), sees per-section pricing, and books.

**UC-4: Forgotten password (web)**
1. User on `/login` taps "Forgot password."
2. Enters email → reset link sent (1hr expiry) via Resend.
3. Clicks link → sets new password → old sessions invalidated → redirected to login.

**UC-5: Rate-limited login attempt**
1. User enters wrong password 5 times.
2. 6th attempt shows "Too many attempts, try again in 15 minutes" — same message regardless of whether the email exists.
3. After 15 minutes (or successful OTP/social login), lockout clears.

---

## 8. Agile Delivery Plan (Solo Developer + Claude)

Since this is one person collaborating with Claude as architect/dev/QA rather than a staffed team, the plan below is intentionally lightweight — a Kanban-flavored backlog with story points for sizing/prioritization, not committed sprint velocity.

### 8.1 Working Cadence
- **Cycle length:** 1-week working blocks ("sprints" in name only) — short enough to re-prioritize based on what's actually shippable, since there's no fixed team velocity to protect.
- **Ceremonies (self-run, ~15 min each):**
  - *Monday planning:* pick the next 8–15 points of stories from the top of the backlog (§6), confirm with Claude any design ambiguity before coding starts.
  - *Friday review:* demo to self, mark Definition of Done items, log what's actually done vs. carried over.
- **Claude's role per story:** (1) clarify acceptance criteria if ambiguous, (2) propose architecture/approach, (3) write/review code via Claude Code, (4) generate test cases (extending the existing QA test plan pattern), (5) flag regressions against prior decisions in this doc.

### 8.2 Backlog Order (maps to §4 phasing)

**Status snapshot as of tenth amendment:** Release 0 is complete and live in prod. Release 1 (MVP Core) is **mostly shipped** — Checkpoints 2, 3, 4 all live in QA and stable. What remains from the originally-scoped ~135 points:

- Checkpoint 5 (refunds) — needs business decisions before build (§9.5)
- E3 (lineup drag-and-drop) — not started, standalone
- E5 (real-time ticket sales dashboard) — not started
- K2 completion (Route split) — deferred to post-Organiser-onboarding
- SMS via MSG91 — blocked on DLT template registration

The original release ordering:

1. **Release 0 — Foundation:** B1–B7 (contextual auth + reset + lockout), A1–A5 (guest browsing) — ✅ Shipped
2. **Release 1 — MVP Core:** C1–C5 (booking/payment/tickets), D1, E1–E2, E6–E10, E12, E13, F1, F2, F4, F5, F7, plus K1–K2 (audience booking fee). ✅ Mostly shipped per snapshot above.
3. **Release 2 — Growth:** F3, F6 (remaining Venue OS), H1–H4 (Admin), G1–G3 (reviews/follow/tip), remaining D-stories, K3–K4 (checkout tip widget, revenue dashboard). Partly shipped (F3, H1/H2/H4, G1/G2).
4. **Release 3 — Mobile Parity:** Same epics rebuilt/ported to React Native, no exclusive features yet. **Not started.**
5. **Release 4 — Exclusive/Scale:** EPIC I (mobile-exclusive), AI Matchmaker, Navarasa search, Art Passport, livestream.

### 8.3 Estimation Notes
- Original Release 0 + 1 estimate: ~135 points (post-fifth-amendment). With Checkpoints 2/3/4 + Fix B + M1 all shipped, the remaining Release 1 backlog is small enough that timeline estimation now depends more on external unblocks (Razorpay live keys, MSG91 DLT, refund decisions) than on engineering velocity.
- Re-estimate after Release 0 shipped: informed the sixth-amendment shipping pace (four checkpoints in one working day was materially faster than the original ~10–15 points/week baseline). Session-length management is the actual current constraint, not story-point throughput.

### 8.4 Definition of Done (every story)
- [ ] Acceptance criteria met and manually verified
- [ ] Corresponding case(s) added to the QA test plan pattern (extend `AforAudience_Web_Login_Test_Plan.md`-style tables per epic)
- [ ] No plaintext secrets, passwords hashed, sessions behave per §3 policy
- [ ] Works on the guest→auth transition path if the story touches a gated action (no dead-ends, no lost context)
- [ ] Deployed to staging (`qa.aforaudience.com`) and smoke-tested before merging to main

### 8.5 Testing Strategy
- Auth/session/role stories reuse and extend the existing QA Test Plan structure (§1–9 of that doc) as the template for all future feature test plans — one table per epic, same columns (Test Case / Steps / Expected Result).
- Every gated-action story needs an explicit "guest attempts action → login prompt → resumes correctly" test case, since that's the whole point of this model.
- Payment and booking stories need a concurrency test (two users booking the last seat simultaneously) given Supabase Realtime seat locking is core to correctness.

---

## 9. Known Gaps & Backlog (Live Tracking)

Replaces the design-phase "What's Next" notes with what's actually true after real implementation and live testing. Organized by priority, not by epic.

### 9.1 Next up

**External blockers:**
- Razorpay webhook secret setup (2-min dashboard task, no code needed)
- Razorpay Route activation (K2 completion) — deferred until real Organiser onboarding is a real feature
- MSG91 DLT registration (SMS via EPIC J)
- Google/Apple OAuth app registration (B4)
- Refund policy decisions (unblocks Checkpoint 5 / C5 refund half)

**Best-unblocked next work (session-friendly, no external unblocks needed):**
1. ✅ Gate ticket booking on phone-verified users only — shipped. `/verify-phone` is a standalone completion flow (reuses the existing SIGNUP_VERIFY OTP endpoints), reachable any time via a sticky nudge banner or a direct redirect when `/api/bookings`/`/api/venue-bookings` reject an unverified user. Non-dismissible nudge (unlike the displayName one) since booking is now actually gated on it.
2. ✅ E3 — lineup drag-and-drop builder — shipped (eighteenth amendment).
3. ✅ E5 — real-time ticket sales dashboard — shipped: per-event dashboard (fifteenth amendment) + overview with Week/Month/Quarter/Year/All Time range filters (sixteenth amendment). Venue Owner revenue view shipped same session as a same-shape extension.
4. ✅ **Venue Owner sales overview** — shipped (seventeenth amendment). `/dashboard/venue/sales`: same pattern as the Organiser overview — range filter, per-venue drill-down, plus an organiser-breakdown table (which organisers rent the most / spend the most). Table on the overview, no dedicated per-organiser page, per the phasing decision.
5. ✅ **EPIC J — full push notification system** — shipped nineteenth amendment. See EPIC J for the complete matrix.
6. ✅ **Postgres connection pool exhaustion** — shipped nineteenth amendment. See §9.2.
7. ✅ **Verification gated at commitment points** (venue publish, event publish, spot application, offer accept) — shipped (PR #97, 18 Jul). See §9.2 for the settled principle.
8. ✅ **Backdated events + invalid time formats rejected server-side** — shipped (PR #97, 18 Jul, second commit). `POST /api/events` now combines date+startTime into an actual instant and rejects if already passed.
9. ✅ **Overnight events show "(next day)"** — shipped (PR #97, 18 Jul, third commit). `formatEventTimeRange()` in `src/lib/eventTime.ts`, applied on public event page, checkout, organiser event management page.
10. ✅ **Toast notification system, full rollout** — pilot shipped (PR #98, 18 Jul); full rollout to the remaining real candidates completed 19 Jul (PRs #107–#110). Audited all 22 dashboard pages first — of the ~16 pages assumed to need it, 7 turned out to be false positives (load-only errors with no user action to wrap, or already handled via a differently-named state) and were correctly left alone rather than converted. The 9 genuine candidates (Artist edit/events, Organiser event edit/lineup/detail, Venue-requests/edit/bookings, Admin settings) now use `useToast()`. Two recurring shapes handled differently: pages that gate full-page rendering on a load error (`if (error && !X) return <errorpage>`) kept that gate untouched and only moved the *action*-handler errors to toast; pages with no such gate got a new dedicated `loadError` state split out from the action-toast path, so a genuine load failure doesn't look identical to an empty list once a toast auto-dismisses.
11. ✅ **Required-field errors name what's missing** — shipped (PR #98, 18 Jul). Venue/event create forms now say e.g. "Please fill in the required fields: Venue Name, Address, City." instead of a generic message, and check those before other validation so the most fundamental gap surfaces first.
12. ✅ **Contextual verification messages** — shipped (PR #99, 18 Jul). `requireVerifiedPhone(user, action)` takes an action string; each of the four gated points now names what it's protecting instead of one generic string.
13. ✅ **Input bounds for seats/price/rating + Maps URL validation** — shipped (PR #100, 18 Jul). Live QA found a venue created with a 13-digit seat count/price (2.2e90 total seats, 2.2e136 per-seat pricing) — the number inputs had `min` but no `max`, and neither form runs native HTML5 validation (custom submit handler). Server now enforces seats 1-100,000, price ₹0-1cr, acoustic rating 0-5, and Maps link must parse as a real URL, on both `/api/venues` and `/api/events`.
14. PWA screenshots in the manifest — needs 2-3 real screenshots of the app on a phone; ~15 min from Claude once the images exist
15. Prod Play Store package — repeat PWABuilder against `https://www.aforaudience.com` with package ID `com.aforaudience.app` (reserved for this) and a **permanent signing key** (never lose). Only when Razorpay live keys are in and real Play Store submission is desired (weeks out).
16. Legal pages — ✅ Drafted and live on QA (`/privacy`, `/terms`) with a visible "Draft — pending legal review" banner and bracketed placeholders (exact booking fee, refund policy, legal entity name/address, Grievance Officer, payout mechanism). Deliberately not final: needs a CA/lawyer review pass once the company is registered, then placeholders filled and the banner removed before promoting to prod.

**Newly unblocked, not yet started (identified session 5, 18 Jul; updated 19 Jul):**
- ~~Roll the toast `fail()` pattern out to the ~16 remaining dashboard pages~~ ✅ **Done, see item 10 above.**
- ~~Hide/disable the review-rating widget client-side when the viewer isn't checked in~~ ✅ **Done, see deliberately-not-built list above (PR #111).**
- ~~Header not reflecting a just-corrected displayName without a full reload~~ ✅ **Fixed (PR #104, 19 Jul).** Root cause was exactly as guessed: `useSession()` caches client-side and `profile/page.tsx` never told NextAuth to refetch after a successful save. Fix calls the session `update()` function post-save; the server-side `session` callback (`auth.ts`) already re-reads `displayName` from the DB on every check, so this alone was enough.
- ~~Two stacked `position: sticky; top: 0` banners (`PhoneVerifyNudge`, `NotificationOptIn`) probably need a z-index/offset reconciliation~~ ✅ **Fixed (PR #102, 18 Jul, via `NudgeStack`)** — single sticky wrapper replacing the independent banners, see §9.2 below.
- Android `.apk`/TWA push notification checks (`POST_NOTIFICATIONS` permission, notification delegation) — needs the PWABuilder/Bubblewrap-generated Android project's files, not just this repo.
- ~~"Wall of Fame" — Artist of the Month / Event of the Month~~ ✅ **Shipped (PR #114, 19 Jul).** See §9.3 entry below for full detail; entry left there marked done rather than deleted, for history.
- ~~Persona value-prop blocks (Audience / Organiser / Venue / Artist) on the homepage~~ ✅ **Shipped (PR #113, 19 Jul).** Copy + layout only as scoped, no backend touched.



### 9.2 Real gaps found through live testing (not hypothetical)

| Item | Detail |
|---|---|
| Dashboard "1fr 1fr" form grids not fully verified on mobile | Systematic search found many `1fr 1fr` grids across Organiser/Venue/Artist dashboard forms. Lower risk than the fixed-pixel-column bugs already fixed — spot-checked, not exhaustively tested. |
| Flexible negotiation has no notifications | ~~Real gap~~ ✅ **Fixed nineteenth amendment.** Both sides now get pushed on every state change (new request, accept/decline/counter) — see EPIC J. |
| **Postgres connection pool exhaustion — live bug, real users affected** | ✅ **Fixed nineteenth amendment.** `EMAXCONNSESSION: max clients reached in session mode - max clients are limited to pool_size: 15` was hitting many routes (`/artists/[id]`, `/api/artists/me`, `/api/auth/[...nextauth]`, `/api/reviews`, more) — first occurrence July 9, so pre-existing, but this session's heavier concurrent testing pushed it into visibly broken pages. Root cause: `prismaPgConfig` in `src/lib/prisma.ts` had no `max` set, so node-postgres defaulted to 10 connections **per Pool instance** — and Vercel spins up a separate instance (own module scope, own Pool) per concurrent invocation, so even 2 concurrent instances could open up to 20 connections against a 15-client cap. Fixed: `max: 1` + `idleTimeoutMillis: 10_000`. Worth remembering for any future serverless-DB config in this codebase. |
| PENDING bookings expire on payment path but not on prod | 15-minute TTL is live on the Razorpay-integrated payment path (sixth amendment), but prod has no Razorpay yet, so an abandoned reservation there still holds capacity indefinitely. Fixes itself when prod gets Razorpay. |
| Postgres-specific TLS bypass still in place | `ssl: { rejectUnauthorized: false }` in `src/lib/prisma.ts` is deliberately still there. Worth testing removal against a real deploy; Supabase's certificate is normally CA-signed, so this may not be necessary at all. |
| Existing users' `displayName` is null | Fix B added the Profile-page edit surface; users must opt in. No backfill was done for existing users. L5 is the follow-up story. |
| **Header doesn't reflect a just-corrected displayName** | ~~From live feedback (`/profile`, 18 Jul): editing displayName updates the Profile page immediately but the header nav still shows the old value until a full navigation/re-render.~~ ✅ **Fixed (PR #104, 19 Jul).** `profile/page.tsx` now calls the session `update()` function after a successful save, forcing NextAuth to refetch immediately instead of waiting for the next window-focus/interval refetch. |
| **Venue Owner application doesn't require phone verification** | ~~Real gap~~ ✅ **Fixed (PR #97, 18 Jul).** Turned out broader than first scoped — the actual gap was every point where an unverified identity becomes something someone else commits to, not just Venue Owner apply. **Settled principle: verify at first external commitment, not at signup or browsing.** Gated: publishing a venue listing (`POST /api/venues`), publishing an event (`POST /api/events`), submitting a spot application (`POST /api/applications` — previously `isVerified` only affected auto-approve eligibility, an unverified artist could still submit into the Organiser's queue), and accepting a venue-negotiation offer (`PATCH /api/venue-booking-requests/[id]`, accept action). Left open on purpose: role-apply itself, profile edits, browsing — same browse-first reasoning as the chatbot's open-access decision. Guard: `requireVerifiedPhone()` in `src/lib/verification.ts`. |
| **Phone-verify nudge banner not sticky on scroll-down** | ~~From the same feedback report — the banner is visible when scrolled to top but not when scrolled further down the page.~~ ✅ **Fixed (PR #102, 18 Jul).** Root cause was a z-index/stacking conflict, confirmed: `PhoneVerifyNudge` and `NotificationOptIn` both used independent `position: sticky; top: 0`, and `SiteNav`'s own sticky positioning covered whichever nudge was showing once nav engaged. Fixed with a new `NudgeStack` wrapper — single sticky container measuring its own height via `ResizeObserver`, publishing a `--nudge-stack-height` CSS var that `SiteNav` now offsets by instead of a hardcoded `0`. |
| **Unbounded numeric inputs (seats/price/rating) + unvalidated Maps URL** | ~~Real gap~~ ✅ **Fixed (PR #100, 18 Jul).** Live QA created a venue with a 13-digit seat count and price (2.2e90 total seats, 2.2e136/seat). Number inputs had `min` but no `max`; both create forms use a custom submit handler so native HTML5 validation never ran regardless. Server now enforces seats 1-100,000, price ₹0-1cr, rating 0-5, Maps link must be a real URL - on both `/api/venues` and `/api/events`. **Same bug family resurfaced 19 Jul on a field this pass missed:** `maxPerformers` on event create had no cap at all (not even client-side `max`) and crashed `prisma.event.create()` with a raw Postgres integer-overflow error when a user typed an enormous number — found by correlating a live feedback report against Vercel's runtime error log rather than by re-auditing the form. ✅ **Fixed (PR #112, 19 Jul)** — capped at 500, client clamp + server validation, matching this row's pattern exactly. Worth a deliberate sweep for any other numeric field that was missed the same way, rather than waiting for the next crash to surface one at a time. |
| Dashboard nav link | Role-based users can only reach Dashboard via Profile, not from the header nav. Small nav-only fix. |
| **Silent admin action failures — found while scoping the toast rollout, not from a feedback report** | ✅ **Fixed (PR #106, 19 Jul).** Auditing all 22 dashboard pages for the toast rollout surfaced 2 pages with no error handling at all, not just an unstyled banner: `dashboard/admin/page.tsx`'s approve/reject on pending Organiser/Venue Owner applications, and `dashboard/admin/feedback/page.tsx`'s status-update action. Neither checked `res.ok` — a failed PATCH (403, 404, network error) looked identical to a successful one, the row just silently didn't move. Both now check `res.ok` and surface the server's real error via toast, plus a success toast on confirmed state changes (previously none). |
| Homepage hero right-column void | ~~Noted, not addressed.~~ ✅ **Fixed (PR #85, this session)** — see hero section history in recent PR commits. |
| Free events not getting PDF/email | ~~Root cause identified~~ ✅ **Fixed seventh amendment (EPIC M1).** |
| Ticket booking has no phone-verification gate | ~~Real gap~~ ✅ **Fixed (thirteenth amendment).** `/api/bookings` and `/api/venue-bookings` now reject unverified users (`reason: PHONE_NOT_VERIFIED`); frontend redirects to the new `/verify-phone` completion flow. Email verification, by contrast, is already correctly non-blocking by design — confirmed via code review, no gap there (see `verify-email/route.ts` comment). |
| **Venue create form loses all data on the phone-verify detour** | From live testing (20 Jul, code review) — **now live-reproduced by Hitesh (21 Jul)**, confirmed happening in practice, not just via code review. `dashboard/venue/create/page.tsx` holds the entire form (name/address/city/seating sections/etc.) in plain `useState`, no draft persistence. The phone-verify nudge banner links to `/verify-phone?next=<path>`, which navigates away and back — a full remount, so every typed field is gone on return. Not a data-loss bug (nothing was ever saved server-side), but a real, reproducible UX gap: a Venue Owner who isn't yet phone-verified gets punished for filling in the form before verifying. Two credible fixes, not yet chosen: (a) persist form state to `sessionStorage` keyed by a draft ID before navigating away, restore on remount; (b) check `isVerified` up front and route to `/verify-phone` *before* the user starts filling in the form, rather than after. (b) is probably the better fix — it matches "verify at first external commitment" (§9.2, PR #97) more literally, catching the gate before investment instead of after. **Related root cause found investigating this (21 Jul), logged separately below:** the reason this triggers at all when saving a Draft (not just Publish) is a second, distinct bug — see "Phone-verification gate fires on Draft saves, not just Publish" immediately below. |
| **Phone-verification gate fires on Draft saves, not just Publish (should only gate real commitment)** | Found investigating Hitesh's live report (21 Jul) of the form-data-loss bug above - a deeper root cause, not yet fixed. Both `POST /api/venues` and `POST /api/events` call `requireVerifiedPhone()` unconditionally near the top of the handler, **before `req.json()` is even parsed** - so the gate fires regardless of whether the request is `publish: true` or `publish: false` (Draft). This directly contradicts the principle already documented in `verification.ts`'s own comment: verification gates real external commitment ("NOT for browsing, profile edits, or role apply itself... verify at first external commitment, not at signup"). Saving a Draft is not an external commitment - nothing is shown to an Organiser or audience member from a Draft - so it shouldn't be gated at all. This is likely why Hitesh hit the verify-detour on *both* "Publish" and "Save as Draft": both paths currently trigger the same gate identically. **Fix is small and well-scoped:** in both `POST /api/venues` and `POST /api/events`, parse `body` first, then only call `requireVerifiedPhone()` when `publish === true`. Not yet applied - logged to backlog per Hitesh's instruction rather than fixed immediately; worth doing alongside whichever fix (a or b) is chosen for the data-loss bug above, since fixing this alone would mean Draft saves no longer redirect to verify at all, shrinking how often the data-loss path is even hit. |
| **Vague error when a seating section is missing its name** | From live testing (20 Jul) — confirmed via code review, not yet fixed. Both `dashboard/venue/create/page.tsx` and the `[id]/edit` page filter sections with `sections.filter(s => s.name.trim() && s.seats > 0)` before submit - a section with seats and price filled in but no name is silently dropped, not flagged individually. If that's the only section, the user sees the generic "Add at least one seating section with a name and seat count," which reads as "you added nothing" when they feel they did. Fix should validate per-row and point at the specific incomplete section (e.g. inline red border + "Name required" under the empty field) rather than a single aggregate message after the fact. |
| Free event checkout shows "₹0" instead of "Free" | ~~From live feedback (15 Jul, category BUG) — "paid event in free amount to replace 0 rupees." Cosmetic, not investigated this session.~~ ✅ **Fixed (PR #104, 19 Jul).** Confirmed cosmetic-only, not a payment bypass — free events (`subtotalAmount === 0`) already auto-confirm server-side and never see a fee. Label fixed in 3 spots on the checkout page: pre-payment total, Pay button text, post-confirmation "Amount paid" summary. |
| Artist username auto-suggestion not working | ~~From live feedback (15 Jul) — register form's username suggestion feature reportedly broken. Not investigated this session.~~ Partially investigated (19 Jul): confirmed via git history that the core feature (live availability check + case-insensitive matching) works correctly, shipped 14 Jul. One concrete bug found by code review and fixed (PR #105) — `suggestAvailableUsername()` had an off-by-one always skipping the first numbered fallback (e.g. suggesting "hitesh2" when "hitesh1" was actually free). Could not reproduce further — no live browser access in this environment, Vercel log retention doesn't reach back to 15 Jul. Not treated as full closure of the original report; re-open if it resurfaces with a specific repro. |
| ~~Admin/Organiser dashboard "arrow-connected sections" UX~~ | ✅ **Fixed (PR #132, 19 Jul).** Recurring feedback (15 Jul and 18 Jul, two separate reports) - the admin dashboard's top nav rendered each link as text suffixed with " →" (e.g. "Feedback →"), which in a row read as a connected sequence rather than five independent destinations. Replaced with distinct bordered pill buttons, no arrow suffix. Confirmed the pattern was specific to this one admin nav row - organiser/venue/artist dashboards don't have it, no further scope needed. |
| ~~Pre-existing type error blocks `next build`'s typecheck step~~ | ✅ **Fixed (PR #115, 19 Jul).** `otp/request/route.ts:58` — `targetPhone` was provably non-null on every real code path but TS couldn't narrow it through the if/else reassignment chain; added an explicit guard. §9.2 sweep (19 Jul, session 3): the suspected follow-on error at `api/events/[id]/attendees/route.ts:41` doesn't actually exist — `bookings.map((b) => ...)` infers `b`'s type from Prisma's `findMany` return shape, never `any`. Confirmed against the live Vercel build log for the current qa HEAD (c578a85): "Finished TypeScript in 12.9s", zero errors, build green. Misdiagnosed at the time under `next build`'s early-abort typecheck; no dedicated sweep needed, the queue was empty. |

### 9.3 Schema exists, no UI yet (backend ready, waiting on frontend)

- **H3** — flag/suspend accounts. ✅ **Shipped (PR #119, 19 Jul).** `/dashboard/admin/users` + `GET /api/admin/users` + `PATCH /api/admin/users/[id]/suspend`. Blocks login immediately (both auth providers), invalidates a live session on its next check (same mechanism as the B5 password-reset check) rather than waiting out the JWT's life, and hides the account's future events/venues from public listings + detail pages. Deliberately does not cancel existing confirmed bookings or already-published events/venues - an audience member who already paid isn't part of the reason for the suspension. Can't suspend yourself or another Admin. Fully reversible, no separate "banned" state. Scope note: only Organiser/Venue Owner suspension has a public-facing effect; suspending an Artist/Audience account blocks login but doesn't touch Artist public profiles - not discussed as in-scope, flag if that's wanted too. **Live-verified same session** against real QA data (test Organiser `organ012`, event "Mic Fire 010" + "Mic Bon-fire 007"): suspended via direct DB write → confirmed both events dropped out of `GET /api/events` and the direct-link detail route returned 404 → unsuspended → confirmed both reappeared and the detail route returned 200 with `organiser.user.isSuspended: false`. Full round-trip, no lingering state. Login-block path (auth.ts) and live-session invalidation (SessionGuard) are code-reviewed but not click-through tested - no browser access in this environment; worth a real login attempt next session for full confidence, though the mechanism mirrors the already-proven B5 password-reset invalidation exactly.
- ~~Admin bookings list surfacing `Booking.deliveryError`~~ ✅ **Already shipped 15 Jul** (`b0b053c`, `1eaed64`) — full admin page at `/dashboard/admin/bookings` with Failed/Pending/Delivered/All tabs, error display, and retry button wired to the redeliver endpoint. This row was never updated when it landed; caught during the 19 Jul session-2 reconciliation when it was about to be picked up a second time. Lesson: §9.3 needs the same reconciliation discipline as the Feedback table, not just a one-time check at session start — a shipped item sitting in "not yet built" is exactly the kind of stale entry the standing process exists to catch, and it slipped through twice.
- **K4** — Admin revenue dashboard. ✅ **Shipped (PR #117, 19 Jul).** `/dashboard/admin/revenue` + `GET /api/admin/revenue-overview`. Platform's own actual revenue only (audience booking fee on CONFIRMED bookings) — per-venue Venue Owner view (`/dashboard/venue/[id]/sales`) and per-organiser views already existed and show *their* gross revenue, which is a different number. Range filter, timeline, top organisers/events by platform fee generated, current fee setting surfaced inline.
- ~~"Wall of Fame" — Artist of the Month / Event of the Month~~ ✅ **Shipped (PR #114, 19 Jul).** `/wall-of-fame` + `GET /api/wall-of-fame`, exactly per the decision recorded here: min 3 reviews, calendar month scope, aggregated in JS (artistId is two joins from Review, not groupBy-able directly). Longer-term idea, not yet built: the hero rotator (currently curated stock photos) could eventually pull from the winning artist's real event photos — ties the existing "For artists, featured here" hero caption to something real.
- **Top Venues / Top Organisers leaderboard.** ✅ **Shipped (PR #115, 19 Jul).** All-time ranking (not calendar-month scoped — that qualifier only ever applied to the two "of the Month" awards), same 3-review floor, top 5 each by avg rating desc then review count. Rendered as two new sections on the same `/wall-of-fame` page rather than a separate nav entry.

### 9.4 Not started at all
- **G3 — Tip.** Razorpay is now live in QA, so the blocker is gone; hasn't been scheduled.
- **B4 — Google/Apple sign-in.** Needs OAuth apps registered in Google Cloud Console and Apple Developer first — external prerequisite.
- **A5 — Search.** No standalone search feature exists; only in-page filters on Events/Artists listings.
- **D2, D4** (Artist profile builder beyond what exists, Hype Score/growth report display).
- **K3** (checkout tip widget), **K5–K8** (Pro subscriptions, promoted placements) — all deliberately Phase B/C, not MVP.
- **Artist financial summary (income + spend)** — Hitesh request (19 Jul), supersedes/broadens the earlier "who tipped me" note. Artist wants: who tipped them, total earnings so far, and how much they've spent to perform. Collaborator framing before this gets scoped: **do not blend recorded compensation with real tips into one trust-implying total.** `Performance.compensationType`/`feeAmount`/`buyInAmount` (PAID/BUY_IN) are off-platform promises between Organiser and Artist per the "never tax the scene" model (§4.5) — the platform never processes or confirms that money changed hands. Tips (once G3 ships) are the only line that's actually real/platform-processed. Proposed shape: "Recorded compensation" (sum of PAID `feeAmount` across confirmed Performances) shown separately from "Recorded spend" (sum of BUY_IN `buyInAmount` - the pay-to-play flip side of the same field, an Artist paying an Organiser for a slot) with a net figure, and "Tips received" as its own real line once G3 ships - not combined. **Hard-blocked on G3 (tipping)** for the tips half; the compensation/spend half has no blocker and could ship independently.
- **Audience financial summary (spend + tips given + freebies)** — Hitesh request (19 Jul). Audience wants: whom they tipped, total spend on events, and value of free events attended. Spend is a straightforward sum of `Booking.totalAmount` across CONFIRMED bookings (no new data needed); free-event value could be framed as a count ("N free events attended") rather than a fabricated rupee figure, since free events have no notional price to subtract from. "Whom I tipped" is **hard-blocked on G3** same as the Artist side. Collaborator addition, not asked for: Organisers/Venue Owners already get real per-entity dashboards (sales overview, range filters); Audience has no equivalent "my activity" surface at all. Worth building spend+freebies+events-attended as one lightweight self-facing summary page rather than three disconnected numbers - cheap engagement/retention hook once scoped.
- **Profile completion nudge/percentage** — from live feedback (18 Jul): "Notify user profile completion percentage... recommend for early completion for better result." Reasonable gamification pattern (bio/genre/styleTag/socialLinks filled = higher %), not scoped or built.
- ~~Netflix-style intro/splash screen~~ ✅ **Shipped (PR #122, 19 Jul), refined several times same day (PR #124, #126, #129, #130) - stable as of #130.** Current implementation (a real architectural rewrite, not just a style tweak - see below): bottom-up bar reveal from `src/app/icon.svg` sized ~2x a typical Android PWA splash glyph (`clamp(240px, 68vw, 440px)`), shrinks+fades into an "AforAudience" wordmark that types itself in letter-by-letter with a blinking cursor, then a tagline fades in below ("Where Art Finds Its Crowd", reused from the homepage hero verbatim). Plays once per browser session, skips entirely on prefers-reduced-motion. Total runtime ~3.4s. **Refinement history:** #124 led with the icon-bars instead of cutting straight to the wordmark (matching the OS's own PWA splash instead of feeling like two disconnected screens). #126 tried a letter-cascade wordmark and a bigger icon - Hitesh preferred the original scale-in block after seeing both live, so text was reverted and only the icon size stuck. Same session, Hitesh then asked for a typewriter-style reveal instead (distinct from both scale-in and cascade) plus the tagline - both shipped in #129. **#129 also had a real bug, not a style issue:** the overlay was JSX with explicit style props, mutated by a synchronous inline script before hydration - React hydration compared the live DOM against its own render output and reverted the script's changes within milliseconds, so the overlay flashed almost invisibly on desktop and didn't appear at all on mobile. **Fixed in #130:** the entire overlay (style, svg, wordmark, tagline, and the script that animates them) is now one single `dangerouslySetInnerHTML` block instead of individual JSX elements - React treats that as opaque and never diffs into it after the initial render, so hydration can't revert the script's DOM mutations. Verified against live QA data this time (not just a clean Vercel build) before calling it done. Also worth recording from this stretch: a burst of 6 back-to-back deployments in ~30 minutes while Hitesh had the site/PWA open on his own devices caused a transient "stuck loading" / blank-page symptom, unrelated to the hydration bug - resolved with a hard refresh / PWA reopen. Lesson: pace deploys with a beat in between when the person has the app open and is actively testing live.
- **Hero banner GIF/video clip (~5s)** — from live feedback (18 Jul). Would replace or supplement the current curated-photo rotator (`HeroRotator.tsx`); larger asset-pipeline question (video hosting/compression) than the existing static-photo approach, not just a swap.
- **Chatbot icon redesign** — from live feedback (18 Jul), suggests something more on-brand (e.g. a mic-in-hand) than the current generic icon.
- ~~Comment box in the venue negotiation flow~~ ✅ **Shipped (PR #134, 19 Jul).** `VenueBookingOffer.comment` (nullable, additive). Optional free-text alongside the counter-offer amount, trimmed/capped to 300 chars, shown in italics in the offer history, included in the push notification when present. Ignored on accept/decline - the note travels with a specific offer, not the request as a whole.
- **Smaller cosmetic/UX items from earlier feedback (15 Jul, status REVIEWED, none built yet):** Rasa emotion descriptions need to be more visually prominent on the homepage; footer heading font size too small for the visual hierarchy it's meant to convey; mobile events page doesn't need a List/Grid view toggle since both look near-identical at that width (`/events`) — all small, independent CSS-level fixes.
- **"Search Engine Suggestion" (15 Jul feedback)** — ties directly to **A5 — Search** above (still not started); logged here as evidence someone specifically wants it, not just a nice-to-have on the roadmap.
- **Artist profile clickable from an Event's lineup section (15 Jul feedback, category BUG, ambiguous)** — the feedback text just states the behavior ("Users can view an artist's profile by clicking the artist listed under the Event → Line-up section") without saying whether that's wanted or unwanted. Needs re-triage with whoever filed it before treating as a bug or a confirmation.
- **"You can have your own event sometimes" (14 Jul feedback, unclear intent)** — vague as filed; not actionable without clarification from the source.
- ~~Live seat availability status (Filling Fast / Spots Available / Sold Out)~~ ✅ **Shipped (PR #136, 19 Jul).** New `src/lib/availability.ts` - ratio-based status (≤15% remaining = Filling Fast, 0 = Sold Out) replacing the old fixed "<10 seats" threshold, which had no sold-out state and didn't scale for large venues. Pure display layer over existing `Event.totalSeats`/`availableSeats` - no schema changes. Listing cards show the badge only for Filling Fast/Sold Out (available stays unbadged, same low-noise approach as before); event detail page always shows the status pill.
- **Seat-map builder for Venue Owners (BookMyShow-style numbered seating)** — Hitesh request (19 Jul), design confirmed 20 Jul (this session). **Ground truth check before designing:** `Venue.seatMap` is an unused `Json?` column nobody reads structurally — real capacity today lives entirely on `TicketTier` (sectionName/price/totalSeats per event) and `Booking.seats` is a `{tierId: qty}` map; the "live lock, no double-booking" in C1 is an atomic count check against active PENDING+CONFIRMED bookings, not per-seat rows. So this is genuinely net-new, not an extension of hidden plumbing. **Confirmed shape (additive, GA path untouched):** `Venue.seatingMode` enum (`GENERAL_ADMISSION` default | `NUMBERED`), opt-in per venue. New `Seat` model (`venueId, tierLabel, row, number, x, y`) — real x/y canvas coordinates confirmed with Hitesh (drag-to-place, true venue shape), not a rows×columns grid. New `BookingSeat` join model (`bookingId + seatId`) — a Numbered-mode booking populates this instead of the `Booking.seats` qty map; GA-mode bookings are completely unaffected, zero risk to the existing money path. Seat hold reuses the existing 15-min PENDING-booking TTL as-is — occupancy check becomes a `BookingSeat` lookup instead of a tier-count subquery for Numbered events, no new expiry job needed. Two new surfaces: a Venue Owner builder (canvas UI, place/drag seats, assign price-tier per seat or per drawn block) and an audience seat-picker (renders the saved layout, greys out taken/held seats). Live-lock UI across concurrent shoppers should use Supabase Realtime — already named in §5 Architecture as intended-but-unbuilt, this is its first real use case. Still flagged as a multi-session build: models + migration, builder UI, picker UI, and booking-flow branching (GA vs Numbered) are each substantial and should ship as separate PRs, verified independently. **Progress (20 Jul, same session):** ✅ Models + migration shipped (PR #140) — `Venue.seatingMode`, `Seat`, `BookingSeat`, applied to QA via Supabase MCP. ✅ Venue Owner builder shipped (PR #141) — `/dashboard/venue/[id]/seat-map`, real x/y canvas (click to place, drag to reposition, per-tier colour coding), `GET/PUT /api/venues/[id]/seats` (full-layout replace, owner/admin-gated). ✅ Audience seat-picker + booking-flow branching shipped (PR #142) — `GET /api/events/[id]/seats` (per-event occupancy, price resolved by matching `Seat.tierLabel` to `TicketTier.sectionName`), `SeatPicker` component wired into the event detail page, `POST /api/bookings` now accepts `seatIds` as a fully separate branch alongside the existing `seats` qty map (GA path untouched, same code, same behavior). All three PRs Vercel-verified green before merge. **Feature is code-complete end-to-end** — a Venue Owner can build a NUMBERED layout and an audience member can book against it. **Not yet done:** no QA venue has a real NUMBERED layout built, so this hasn't been exercised with a live test booking. Next step before calling this fully done is Hitesh building a small test layout and running one real booking through it. Known accepted limitation carried over from the GA path: the per-event occupancy check has a theoretical TOCTOU race under Postgres Read Committed isolation (two concurrent requests could both pass capacity check before either commits) — pre-existing in the GA tier-count check, not new here, not fixed here. **Discoverability fix (PR #143):** the builder was only reachable from the venues list card, not from create/edit — added a callout link inside the venue edit page's Seating & Pricing section. **Grid Generator + stage bar + reset (PR #144, same session, from two real venue references Hitesh supplied):** manual click-to-place alone doesn't scale to a real hall (Scenario A: single 3×5 block, gangway as a side margin; Scenario B: two blocks/30 rows with tapering column counts per row-range and a horizontal gangway between rows 10/11 — both now directly expressible). Added: row-groups (rows × columns, any number of tapering ranges), horizontal aisles (gap after row N), Single or Two-Block layouts with a configurable center-aisle width, row lettering past Z (AA, AB... for 26+ rows), and a visual Stage bar (both builder and audience picker) with a locked-in **stage-facing convention** — left/right in this system means the performer's left, not the audience's, stated explicitly in the builder UI. **Bug caught before shipping, not after:** two-block layouts numbering both blocks 1..N per row would have collided on the `(venueId, row, number)` uniqueness constraint since both blocks share a row letter — fixed to continuous numbering across the aisle (row B: 1-20 left, 21-40 right), which also happens to match real theater signage. Reset button clears local edits only (confirm-gated), nothing server-side until Save. **Still open:** curved/angled rows and balcony/mezzanine tiers were flagged as future scenarios, not built. No QA venue has been built with the generator yet — still the same outstanding "run one real test booking" step from the original three PRs, now also covering the generator path.

**Progress continued (20-21 Jul, sessions 10-11) - architectural redesign, now code-complete:** Hitesh paused freeform coding after #144 to agree a cleaner architecture before continuing; the redesign below is now fully built and merged, all Vercel-green.

- ~~Guided Setup wizard~~ ✅ **Shipped (PR #145).** Plain-language front door onto the grid generator (Guided Setup vs Draw It Myself, both first-class) for venue owners uncomfortable with the freeform canvas.
- ~~Venue creation forced a mandatory GA section even for Numbered venues~~ ✅ **Fixed (PR #146).** Create form now offers Section-based (GA) vs "Numbered seats - I'll build this after" (single approximate capacity number, real layout built later in the builder).
- **Zone-model rewrite** ✅ **Shipped (PR #147, #148).** Confirmed architecture: a seat's pricing identity comes from its row-group ("zone" - e.g. Front/Mid/Recliner), never from which side of a vertical aisle it's on; vertical aisles are pure walkways with no pricing identity (reverses what #145 initially shipped); horizontal aisles are usually a zone boundary by convention, not enforced. Wizard step 2, preview `colorForTier`, and the dead advanced-panel "Section names" block (all flagged broken in the session-10 handoff) rewritten/removed accordingly. Publish-gating for NUMBERED venues (both create and edit paths) and `Venue.capacity` sync after a real seat map is saved, also landed here.
- **Venue Levels** ✅ **Shipped (PR #149).** Real per-level independent layouts (Ground Floor/Balcony/etc.) - starts invisible as one implicit level, a level switcher appears once a second is added. Lives in the main wizard/canvas entry point, not advanced-panel-only, per Hitesh: "We must be able to design seat mapping per level."
- **Per-zone vertical aisles** ✅ **Shipped (PR #149).** Moved from a single global `GridConfig` setting to living on each zone (`RowGroup`) independently - a 16-column zone can have 4 splits while a 20-column zone in the same layout has 2.
- **Per-zone suggested pricing** ✅ **Shipped (PR #149).** New `VenueZonePrice` table (migrated to QA). Deliberately prefill/default only (decision 10a) - organiser can always override at event creation, same as GA section pricing already worked.
- **Row alignment (left/center/right, stage-referenced)** and **multiple horizontal aisles ("+Add another gangway")** ✅ **Shipped (PR #149)**, moved into the main wizard from advanced-panel-only.
- **Vertical aisles at the true zone edge** ✅ **Fixed (PR #150).** Cut-point clamp widened from `[1, cols-1]` to `[0, cols]` inclusive so a walkway can sit against the wall (before seat 1 / after the last seat), not just strictly between two seats.
- **Accidental seat placement on canvas click** ✅ **Fixed (PR #150).** Added an explicit **Manual Placement** toggle - defaults OFF right after Guided Setup (reviewing/scrolling a generated layout is now inert), defaults ON for Draw It Myself.
- **Event-creation pricing gap for NUMBERED venues** ✅ **Fixed (PR #151).** `GET /api/venues` now returns `seats`/`zonePrices`; the event-creation page derives real per-zone pricing sections from the venue's actual `Seat.tierLabel` layout instead of the dead GA-only `Venue.seatMap.sections` field, which had left NUMBERED venues silently falling through to flat free-text Total Seats/Ticket Price (confirmed live against venue V09, a real 150-seat/3-zone venue showing "500 seats / ₹98"). `POST /api/events`, the booking flow, and the audience seat-picker were already fully seatingMode-agnostic - no changes needed there.
- **Misleading "Event published" toast while pending venue approval** ✅ **Fixed (PR #152).** Button relabels to "Check approval status" while `PENDING_APPROVAL`, with an honest toast reflecting the real status the server returns, rather than disabling the button - `PATCH /api/events/[id]` genuinely re-checks approval on every call, so re-clicking while pending is a legitimate recheck, not a no-op.

**Seat-map feature is now architecturally complete end-to-end**, across Guided Setup + Draw It Myself, zones, per-zone aisles/pricing, Levels, and publish-gating. **Still open, not yet built:**
- **No real end-to-end NUMBERED booking has been run yet.** All of the above is verified via code review, simulation, and Vercel-green builds only. Next real test: publish an event against a seeded NUMBERED venue (V09 - 150 real seats/3 zones, prices already set), then book a real seat as an audience member through the seat-picker.
- **Organiser seat-map visibility at event creation.** Organiser currently prices zones as a flat list with zero spatial context - no way to see zone shape or (with Levels now real) which level a zone belongs to. Proposed: read-only "View seat map" toggle next to the zone-pricing list, NUMBERED venues only, reusing existing seat-square rendering, no new rendering code. Sequenced after the first real end-to-end booking test above.
- **Event-creation pricing aggregates zones by name across ALL levels of a venue** (PR #151 gap, flagged not fixed) - a same-named zone on two different levels (e.g. "General" on Ground and Balcony) merges into one priced tier today. Needs its own pass once Levels sees real multi-level usage.
- **"Split is missing...vertical"** - an earlier live-testing report, never fully reproduced/clarified with Hitesh, raised before the edge-aisle fix (#150) landed. Worth a recheck now that both the per-zone rewrite and the edge-case fix are in.
- Curved/angled rows and balcony/mezzanine-as-distinct-tiers (separate from Levels) still flagged as future scenarios, not built.
- **Multi-platform / external-channel seat accounting** — Hitesh request (19 Jul): how to handle an Organiser who also sells the same event's tickets elsewhere (other platforms, WhatsApp, door sales), so AforAudience's seat count doesn't oversell against real-world availability. Ruled out real-time API sync with competitor ticketing platforms (BookMyShow etc. don't hand out partner APIs to outside apps — enterprise-only territory, and most Organisers' "other channel" here is realistically WhatsApp/cash, not an integrable system anyway). Recommended direction instead: an **allocation model** — Organiser sets total venue capacity as today, plus an optional "AforAudience allocation" (a subset reserved for sale through us, so we structurally can't oversell against it), plus a manual "mark N more sold elsewhere" adjustment field on the event dashboard for keeping the shared pool honest. Not yet confirmed with Hitesh as the final direction or scoped/built.

### 9.5 Business decisions still open, not engineering ones
- **The exact audience booking fee amount** for prod launch — Checkpoint 4 ships at ₹0 default; production launch needs the real number. About page describes it as "small flat fee (e.g., ₹10–15)" — pick the specific value.
- **Refund policy for Checkpoint 5.** Full refund? Partial refund? Cutoff window (e.g., 24hr before event)? Does the platform's booking fee refund with the ticket, or is it non-refundable as an operational cost? These are founder-and-legal calls, not engineering ones.
- **Whether to include the optional checkout tip (K3)** in Phase A or defer to Phase B. Small either way.
- **When exactly to introduce Venue Pro (K5).** The About page commits to "earn the right to charge before we charge" — observed, not planned.
- **Compensation transparency at apply-time.** Two related live-feedback reports (18 Jul), both from an Artist account mid-session: currently the Organiser decides buy-in/paid/free per applicant only *after* approving them (§4.5 note in the Application flow) — an Artist applying has no visibility into which of the three it'll be before applying, and can't see it while browsing events to decide whether to apply at all. Real product question, not a bug: should this be Organiser-published upfront (locks them into declaring paid/free/buy-in and possibly an amount, before any applications come in), or Organiser-set-at-approval as today (more flexible for the Organiser, less transparent for the Artist)? Needs a founder call before scoping the schema/UI change.
- **Email verification as a gate before account activation.** Live feedback (15 Jul) requests this — but it directly conflicts with an already-documented deliberate decision (`verify-email/route.ts`'s own comment, referenced in §9.2/EPIC B): email verification is intentionally non-blocking, only phone/OTP gates real actions like booking. Needs a founder re-confirmation of the existing decision, not a default implementation of the feedback as filed — a real user expected stricter gating than what was deliberately chosen.

---

## 10. Session & Handoff Discipline (established seventh amendment)

Two rules that make future sessions efficient, given the collaborator-and-context-window realities of this working model:

1. **This design doc lives in the repo (`docs/design.md`), not in project files.** Loaded on demand, section-scoped, not on every message. Project files are reserved for the current rolling handoff only.
2. **Handoffs are ≤60 lines.** Format: `Shipped` / `Broke or found` / `Blocked on` / `Next best unblocked work`. No lessons-learned narrative (that goes here if it's genuinely reusable), no restating decisions this doc already contains. The 300+ line format was burning 30–40% of the following session's context budget with no useful gain.
3. **Trigger:** when a working session's context usage hits ~90%, Claude produces the handoff and notifies the user rather than pushing through and running out.

---

## 11. Mobile App Strategy (established seventh amendment; QA APK validated eighth amendment)

The original plan (Release 3, ~₹6.4L outsourced, ~5 months to build React Native parity) still stands as the eventual goal but is deliberately deferred until after MVP revenue is proven. In the meantime, the recommended path to an Android-installable app is:

**Stage 1 — PWA-ify the Next.js app.** `manifest.json`, service worker, app icons, install prompt. Shipped in PRs #41 and #42 (eighth amendment). Installable from Chrome on Android ("Add to Home Screen") — home-screen icon, fullscreen, offline shell for saved ticket QRs.

**Stage 2 — Wrap the PWA as a TWA (Trusted Web Activity).** Feed the public prod URL into PWABuilder.com. Produces a signed Android APK, Play Store-ready. **QA APK generated in the eighth amendment** with package ID `com.aforaudience.qa.twa` (throwaway signing key — QA never goes on Play Store). PWABuilder uses Bubblewrap under the hood; if PWABuilder ever becomes flaky, running Bubblewrap locally produces the same output. Time from starting Stage 2 to APK in hand: ~15 minutes.

**Prod path (when ready — post-KYC, post-live-keys):**
- URL: `https://www.aforaudience.com` (not qa)
- Package ID: `com.aforaudience.app` — **reserved permanently for prod, do not use anywhere else**
- Signing key: generate new one via PWABuilder, save the keystore + password to at least three locations (drive, laptop, one more). Loss of this key = new Play Store listing forever.
- Upload the resulting `.aab` to Play Store. Review takes 3-7 days first time.
- Digital Asset Links: `public/.well-known/assetlinks.json` with the app's SHA-256 fingerprint (from the ZIP's `assetlinks.json` file). Without this, the app shows a URL bar. Same setup will apply for QA — a follow-up story.

Advantages of the PWA+TWA path over React Native: one codebase, ships to every phone the same day, no Play Store review cycle for web updates, no React Native/Expo divergence, no separate ~5-month build. Push notifications via Web Push API cover most of what the notification table in EPIC J needs.

**Constraints:**
- TWA validates against a public URL; deployment protection must be off or bypassed. Turned off across the project in the eighth amendment.
- If the TWA hits a wall on a genuinely-native capability (e.g. a QR scanner for venue-door check-ins in Phase 4), then that specific feature justifies going React Native — not the whole app all at once.

Full React Native (Release 3) revisits after MVP traction has been observed on the PWA/TWA path.

---
*Document version: 3.4 — Twenty-third amendment (19 Jul 2026, session 3, 22 PRs total #116–#137, all Vercel-verified before merge).* Session opened with the standing reconciliation pass (4 Feedback-table bugs, all already resolved — one status lagged, fixed; §9.2 type-error sweep closed as a non-issue, no real error existed). Shipped K4 (admin revenue rollup) and H3 (account suspension) — both live-verified against real QA data, not just a clean build; H3's suspension listing-hide was round-tripped live (suspend → confirm hidden → unsuspend → confirm restored) using a real test Organiser account. Built the Netflix-style intro splash end to end through several rounds of live feedback (icon-bars-first sequencing, size doubling, three different wordmark styles tried before landing on typewriter+cursor, a tagline added) — this included catching and fixing a genuine React hydration bug (PR #130): a client-mutated JSX overlay was getting silently reverted by hydration within milliseconds, invisible on desktop, totally absent on mobile; fixed by making the whole overlay one opaque `dangerouslySetInnerHTML` block instead of individually-managed JSX. Also diagnosed and explained an unrelated transient "stuck loading" incident from deploying 6 times in ~30 minutes while devices had tabs open — not a code defect. Closed out the admin nav "arrow-connected sections" complaint (raised independently twice) by replacing arrow-suffixed text links with bordered pill buttons. Shipped the venue-negotiation comment box requested by an actual tester of the Flexible negotiation flow. Shipped live seat-availability status badges (Filling Fast/Spots Available/Sold Out), replacing an old fixed-threshold badge that had no sold-out state. Closed with three new backlog items from Hitesh: seat-map builder for numbered venue seating (scoped as an opt-in second mode alongside general admission, flagged as its own multi-session build — not started), multi-platform seat accounting for Organisers selling the same event elsewhere (recommended an allocation model over chasing competitor-platform API access — not yet confirmed or built), and a live q&a on why the intro-splash hydration fix doesn't require testers to repeat any manual cache-clearing steps on revisit.

**Twenty-fourth amendment — 20 Jul 2026 session.** Opened with the standing reconciliation pass against the Feedback table: 3 open BUG-category items, all already resolved or already correctly deferred — venue-owner OTP + sticky-banner report was stale (both fixed PR #97/#102), marked RESOLVED in the DB; artist-profile-from-lineup and username-autosuggestion reports both already carry accurate "needs re-triage" / "no new repro" notes in §9.4, left as-is. No code work followed from Feedback this session. Remainder of the session was a dedicated design pass on the seat-map builder (see §9.4 entry, rewritten in place) — ground-truthed against the actual schema first (confirmed `Venue.seatMap` is dead weight, capacity is really tier-count-based today) before proposing the `Seat`/`BookingSeat` model split, confirmed with Hitesh that seat placement needs real x/y canvas coordinates (not a rows×columns grid) to represent true venue shapes. Design confirmed, not yet built — next session starts on migrations + builder UI.
*Confidential — Do not share*
