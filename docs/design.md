# AforAudience — Master Design Document v2.4
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

---

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
| E3 | As an Organiser, I can build a lineup (drag/drop, time blocks) | 8 | ⬜ Not started — performer slots exist in schema, no lineup-builder UI |
| E4 | As an Organiser, I can approve/reject Artist applications | 3 | ✅ Shipped — confirmed directly in code; was mislabeled not-started in earlier passes of this doc |
| E5 | As an Organiser, I can view real-time ticket sales | 5 | ⬜ Not started |
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
| F6 | As a Venue Owner, I can see the agreed rate/duration snapshotted on each confirmed VenueBooking, unaffected by later changes to my published rates | 3 | ⬜ Not started |
| F7 | As a Venue Owner, when an Organiser counters my quote, I see their new number alongside the full offer history and can accept, decline, or counter again | 5 | ✅ Shipped |

### EPIC G — Reviews, Tips, Follow
| ID | Story | Pts | Status |
|---|---|---|---|
| G1 | As audience, I can follow an artist (gated) | 2 | ✅ Shipped |
| G2 | As audience, I can rate/review a performer post-show (gated) | 3 | ✅ Shipped — not restricted to actual attendees, since there's no check-in/attendance system yet |
| G3 | As audience, I can tip an artist directly, 100% passthrough (gated) | 5 | ⬜ Not started — Razorpay is now live in QA (sixth amendment), so the technical blocker is gone; ship when it fits priority |

### EPIC H — Admin & Trust
| ID | Story | Pts | Status |
|---|---|---|---|
| H1 | As Admin, I can approve/reject Organiser and Venue Owner applications | 5 | ✅ Shipped — verified live |
| H2 | As Admin, I can view a dashboard of pending approvals | 3 | ✅ Shipped — verified live |
| H3 | As Admin, I can flag/suspend suspicious accounts | 5 | ⬜ Not started |
| H4 | As Admin, I can configure the audience-side booking fee from a settings screen. | 2 | ✅ Shipped alongside Checkpoint 4 (K1). `/dashboard/admin/settings`. Dead columns from fifth amendment are correctly not surfaced. |

### EPIC I — Mobile-Exclusive (Phase 4)
Shake to Discover (5), QR Check-in (5), Offline tickets (5), AR Venue Preview (13), Live Reaction Feed (8), Pre-Show Chat (5), Add to Wallet (5).

### EPIC J — Notifications
Push/SMS/email triggers per Design Doc §11 table — one story per channel per trigger type, 2–3 pts each. SMS remains blocked on MSG91 DLT registration; email is live via Resend (ticket delivery only, other triggers not yet wired).

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

**Status snapshot as of seventh amendment:** Release 0 is complete and live in prod. Release 1 (MVP Core) is **mostly shipped** — Checkpoints 2, 3, 4 all live in QA and stable. What remains from the originally-scoped ~135 points:

- Checkpoint 5 (refunds) — needs business decisions before build (§9.5)
- E3 (lineup drag-and-drop) — not started, standalone
- E5 (real-time ticket sales dashboard) — not started
- F6 (rate snapshot on confirmed bookings) — not started
- K2 completion (Route split) — deferred to post-Organiser-onboarding
- SMS via MSG91 — blocked on DLT template registration
- L5 (displayName backfill hint) — not started

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
1. `assetlinks.json` at `/public/.well-known/assetlinks.json` with the QA APK's SHA-256 fingerprint — hides the URL bar in the installed TWA (~5 min once the fingerprint is copied from PWABuilder's ZIP)
2. F6 — rate snapshot display on confirmed VenueBookings (~1 hr)
3. E3 — lineup drag-and-drop builder (larger, standalone)
4. E5 — real-time ticket sales dashboard (larger, standalone)
5. PWA screenshots in the manifest — needs 2-3 real screenshots of the app on a phone; ~15 min from Claude once the images exist
6. Prod Play Store package — repeat PWABuilder against `https://www.aforaudience.com` with package ID `com.aforaudience.app` (reserved for this) and a **permanent signing key** (never lose). Only when Razorpay live keys are in and real Play Store submission is desired (weeks out).

### 9.2 Real gaps found through live testing (not hypothetical)

| Item | Detail |
|---|---|
| Dashboard "1fr 1fr" form grids not fully verified on mobile | Systematic search found many `1fr 1fr` grids across Organiser/Venue/Artist dashboard forms. Lower risk than the fixed-pixel-column bugs already fixed — spot-checked, not exhaustively tested. |
| Flexible negotiation has no notifications | Either side has to manually check `/dashboard/venue-requests` to know it's their turn to respond — no indication anywhere else in the app. |
| PENDING bookings expire on payment path but not on prod | 15-minute TTL is live on the Razorpay-integrated payment path (sixth amendment), but prod has no Razorpay yet, so an abandoned reservation there still holds capacity indefinitely. Fixes itself when prod gets Razorpay. |
| Postgres-specific TLS bypass still in place | `ssl: { rejectUnauthorized: false }` in `src/lib/prisma.ts` is deliberately still there. Worth testing removal against a real deploy; Supabase's certificate is normally CA-signed, so this may not be necessary at all. |
| Existing users' `displayName` is null | Fix B added the Profile-page edit surface; users must opt in. No backfill was done for existing users. L5 is the follow-up story. |
| Dashboard nav link | Role-based users can only reach Dashboard via Profile, not from the header nav. Small nav-only fix. |
| Homepage hero right-column void | Noted, not addressed. |
| Free events not getting PDF/email | ~~Root cause identified~~ ✅ **Fixed seventh amendment (EPIC M1).** |

### 9.3 Schema exists, no UI yet (backend ready, waiting on frontend)

- **F6** — `VenueBooking` rate snapshot display on confirmed bookings
- **E3** — lineup drag-and-drop builder (performer slots exist in schema)
- **E5** — real-time ticket sales view
- **H3** — flag/suspend accounts
- **Admin bookings list surfacing `Booking.deliveryError`** — the retry endpoint (`POST /api/admin/redeliver-ticket/[bookingId]`) shipped in the eighth amendment (PR #43); still no admin UI that lists bookings with delivery errors and calls it. Admin currently calls it via curl. ~2 hr for a proper admin bookings page.
- **K4** — Admin revenue dashboard (config surface exists at `/dashboard/admin/settings` but no revenue view)

### 9.4 Not started at all
- **G3 — Tip.** Razorpay is now live in QA, so the blocker is gone; hasn't been scheduled.
- **B4 — Google/Apple sign-in.** Needs OAuth apps registered in Google Cloud Console and Apple Developer first — external prerequisite.
- **A5 — Search.** No standalone search feature exists; only in-page filters on Events/Artists listings.
- **D2, D4** (Artist profile builder beyond what exists, Hype Score/growth report display).
- **K3** (checkout tip widget), **K5–K8** (Pro subscriptions, promoted placements) — all deliberately Phase B/C, not MVP.

### 9.5 Business decisions still open, not engineering ones
- **The exact audience booking fee amount** for prod launch — Checkpoint 4 ships at ₹0 default; production launch needs the real number. About page describes it as "small flat fee (e.g., ₹10–15)" — pick the specific value.
- **Refund policy for Checkpoint 5.** Full refund? Partial refund? Cutoff window (e.g., 24hr before event)? Does the platform's booking fee refund with the ticket, or is it non-refundable as an operational cost? These are founder-and-legal calls, not engineering ones.
- **Whether to include the optional checkout tip (K3)** in Phase A or defer to Phase B. Small either way.
- **When exactly to introduce Venue Pro (K5).** The About page commits to "earn the right to charge before we charge" — observed, not planned.

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
*Document version: 2.4 — Eighth amendment (six PRs merged in one working day: free-event delivery fix, docs into repo, PWA installable + score, admin retry endpoint, displayName nudge; QA Android APK validated end-to-end via PWABuilder/Bubblewrap)*
*Confidential — Do not share*
