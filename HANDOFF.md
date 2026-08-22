# AFA Handoff — 22 Aug 2026 session (Organisers round)

**qa HEAD: `1ea773cd8d831e0d49df75b5d04a8e6d05b5cbd8`**
(verify fresh at next session start — do not trust this blindly)

🔴 **Razorpay and Google Maps/Places billing dashboards remain unchecked
across many sessions now, including this one.** Carried forward again —
see "Open items" below. First thing to do next session, before anything
else.

🔴 **Local dev DB unreachable, now confirmed across at least two
sessions.** `npm run dev` hits Prisma `P1001: Can't reach database
server` on every DB-backed route (`/api/artists`, `/api/organisers`,
`/api/events`, NextAuth login, etc.) — reconfirmed again at the end of
this session via a live `curl`. This is no longer a one-off: worth
treating as a real environment issue to fix, not something to keep
working around with Playwright network mocks every session.

---

## Shipped this session (all merged to qa)

This session was a single continuous thread on the **Organisers**
surface (embed grid, its search box, and the profile page) — from audit
through four separate PRs, in order:

1. **PR #520 — `c345e1a`**: Consolidated Venues/Artists/Events search
   inputs onto one shared `SearchInputBox` component. Groundwork PR,
   not itself part of the Organisers work but merged first in this
   session's chain.

2. **PR #521/#522 — `70ca872`/`a2b5e5d`**: Artists search box fixes
   (320px desktop cap removed, then the real root cause — missing
   `flex-grow` on the parent wrapper — fixed to match Venues' pattern).
   Verified via Playwright: 223px → 1152px.

3. **Audit round (no code, findings only)** — three docs written this
   session, none yet committed to git (see "Local-only docs" below):
   - `docs/organisers-grid-embed-audit.md` (**committed to qa**, `b6cdb7a`) —
     full audit of `OrganisersGridEmbed.tsx`: confirmed it's the *only*
     real in-app entry point to organiser browsing (2 clicks from
     Events; the standalone `/organisers` directory has zero inbound
     nav/footer links), and that it was still on the pre-Phase-2c stale
     token family (white cards, `Georgia, serif`, `--afa-terracotta`,
     rounded corners) — same family as the standalone directory page,
     not a third treatment.
   - `docs/afa-design-tokens-reference.md` (local-only, not committed) —
     reference doc for real `--afa-*` tokens/patterns, built from
     reading the shipped codebase. Used as the source of truth for
     every restyle this session.
   - `docs/event-detail-organiser-tab-audit.md` (local-only) — confirmed
     there's no "Organiser tab" on Event Detail (removed in the
     Events rebuild); it's a one-line "Organised by {name}" credit that
     links to `/organisers/[id]`.

4. **PR #523 — `99c40dc`**: Rebuilt `OrganisersGridEmbed.tsx` onto the
   Phase 2c dark/sharp-corner convention (verbatim values copied from
   `VenuesGridClient.tsx`'s `.afa-venue-card`/hover pattern) + swapped
   avatars onto the shared `Photo` component for the amber/sepia
   duotone treatment already shipped on Venues/Artists/Events.

5. **PR #524 — `aa55b3e`**: Follow-up bug found via a live Supabase
   query against `aforaudience-qa` — 10/15 approved QA organisers seed
   `avatarUrl` to `avatars.githubusercontent.com` filler (same class of
   problem as the documented Artists "Sai Jain / GitHub mascot"
   incident), and the embed never gated on the existing
   `isPlaceholderImageUrl()` util the way Venues/Artists already do —
   so placeholder avatars were rendered through the duotone filter as
   if real, producing a muddy amber-on-black texture. Fixed by adding
   the same guard.

6. **PR #525 — `b31a0d6`**: The Organisers-tab search box on
   `/events` had a stray `maxWidth: "420px"` inline cap (traced via
   `git log -S` to the original Events rebuild, #514 — pre-dates the
   shared-search-box consolidation and was never removed). Removed;
   confirmed live on `qa.aforaudience.com` before/after — 420px → 1088px,
   matching the Events-mode instance exactly.

7. **PR #526 — `1ea773c`**: Full rebuild of the Organiser Profile page
   (`src/app/organisers/[id]/page.tsx`) against the approved Figma Make
   export ("Organiser Profile Page Design") — replaced the old white
   "Events by {name}" panel with the Phase 2c dark/sharp-corner system.
   Added `createdAt` (member since) and `tours` (LIVE/COMPLETED stops
   only) to the API response; tightened that route's events query from
   `include` to an explicit `select` (was pulling every Event column
   into a response that's supposed to be an explicit public projection).
   Restyled `OrganiserFollowButton` onto `VenueFollowHeaderButton`'s
   exact chrome. Added ~23 new i18n keys across all 11 dictionaries
   (real translations, not placeholders). Deliberate deviations from
   the export, all called out in the commit message: Past Events capped
   at 5 with a "View all N" expand (export's own mock never needed
   this), section count badges always show the true total not the
   capped subset, Past Events gets a real empty state instead of being
   hidden when zero, Tour cards aren't links (no `/tours/[id]` route
   exists in this app).

**Net result**: every real touchpoint for organiser data on the public
site — the Events↔Organisers toggle, its search box, and the profile
page it links to — is now on the current dark design system. The one
deliberately out-of-scope piece is the **standalone `/organisers`
directory page** (`src/app/(public)/organisers/page.tsx`) — still
`Georgia, serif`/`--afa-terracotta`/light-panel/rounded-corner, and
still has zero inbound links from `SiteNav`, the homepage footer, or
`Hero.tsx`. Explicitly deprioritized in `docs/organisers-grid-embed-brief.md`
pending a product decision on whether it needs a nav entry point at all.

### Local-only docs — not committed anywhere
`docs/afa-design-tokens-reference.md` and
`docs/event-detail-organiser-tab-audit.md` are real, useful reference
docs written this session but still sitting untracked in the local
working directory (same sandbox this session ran in) — never
committed, never pushed. They'll survive as long as the next session
runs in this same local checkout, but won't exist if a fresh clone is
used. `docs/search-input-audit.md` is also untracked/uncommitted (older,
predates this session's own work per its content, provenance unclear —
worth checking before deciding whether to commit it too). Worth
committing at least the tokens-reference doc somewhere durable
(`qa` directly, or its own small PR) since it's now the de facto
styling reference this session leaned on repeatedly.

### Process note carried forward from the prior handoff, reconfirmed
This session deliberately branched fresh off `origin/qa` (via
`git fetch origin qa` first) for every one of PRs #523 through #526,
specifically because the prior handoff flagged mid-session merges
causing diverged git graphs. That discipline held up cleanly this
time — no branch-divergence issues this session. Keep doing this.

---

## Open items, carried forward

1. 🔴 **Razorpay and Google Maps/Places API billing dashboards** —
   unconfirmed across many sessions now, this one included. Still
   first-thing-next-session.

2. 🔴 **Local dev DB (P1001)** — see top of doc. Now spans 2+ sessions;
   worth actually diagnosing rather than mocking around again.

3. **Standalone `/organisers` directory page** (new this session, see
   above) — still fully stale/pre-Phase-2c, still orphaned from real
   nav. Needs Hitesh's call: give it a nav entry point and redesign it,
   or leave it as dead weight the way it's been treated so far.

4. **GEN-2608-073** — Artist directory cards (real-photo ones) still
   read as "too basic/ordinary." Still NEW. No design direction agreed
   — needs a real conversation with Hitesh before building anything.

5. **Empty-state design gap** — 1,140 approved QA venues, only 22 have
   facilities data, only 1 has a seat map. Never designed. Hitesh
   hasn't picked a direction: (a) design a real sparse/empty state, or
   (b) treat it as a data problem and push owner-side facility/seatmap
   entry instead.

6. **Owner card city field** — export shows a city row with no backing
   schema/API field. Needs Hitesh's call: add it for real, or rule it
   out of scope.

7. Figma MCP still cannot pull raw source for Figma Make files
   (unconfirmed again this session — not re-tested, but no reason to
   think it's fixed). Claude Code local file reads remain the workaround.

8. **A pre-existing `git stash` on `qa`** (`WIP on qa: bb8613e Merge
   pull request #50...`) — not created this session, not touched this
   session either (left alone deliberately since its contents/owner are
   unknown). Worth asking whoever created it whether it's still needed
   before it gets forgotten.

9. **Leftover remote branch** `fix/artists-search-flex-grow` — its
   commit landed via PR #522 but the branch itself is still on origin
   (GitHub's auto-delete-on-merge didn't fire for it, unlike #523–#526's
   branches which are gone). Harmless, safe to delete manually.

---

## New from prior session — Venue Owner Portal (not started, ready to kick off)

Hitesh shared 6 screenshots of the live Venue Owner dashboard (Your
Venues, Edit Profile, Revenue Overview, Booking Requests calendar,
Flexible Requests, Register Venue form) — flagged as visually the odd
one out on the whole platform: plain white calendar grid, default form
styling, an almost-empty revenue chart, no illustration/duotone
treatment anywhere. Functionally solid, never had a design pass.

A two-step design brief was written last session and is ready
(`venue-owner-portal-design-brief.md`):

1. **Step 1 (send to Claude Code first, read-only)**: extract a real
   design-token/pattern reference from the shipped codebase — this is
   now effectively superseded by `docs/afa-design-tokens-reference.md`
   written this session (see "Local-only docs" above) — reuse that
   instead of redoing this step from scratch.
2. **Step 2**: paste that output into the Figma Make prompt (already
   drafted, covers all 6 screens as one cohesive portal) and run it.

**Not yet sent to Claude Code — still the next thing to do**, once the
🔴 billing dashboard check is out of the way. Untouched this session —
the Organisers thread took the whole session instead.

---

## Still on the horizon (unchanged from prior sessions)

- Port Figma Make designs into the actual codebase (website "AFA
  Website V1" dark editorial bento, mobile "AFA Mobile App" original
  tab) — not started for either.
- Four Rooms icon/typography treatment (GEN-2608-071) — deferred.
- Venue Owner landing page — queued after artist pages confirmed
  (still mid-fidelity-review per GEN-2608-073 above). Organiser landing
  page (the standalone `/organisers` directory) moved from "queued" to
  its own open item (#3 above) now that the profile page it links to
  is done.
- Seat-map remaining open items (architecture already shipped, PRs
  #147–#151, #193) — per-zone price input on Manual Canvas, grid-
  generator vs. draw-it-myself redundancy, cross-level zone pricing
  aggregation bug, no visual layout preview at event creation,
  curved/angled rows + balcony-as-distinct-tier not built, full venue
  snapshot/lock deferred.

---

## Reminders that don't change session to session

- Session-start: verify qa HEAD fresh (don't trust this doc's SHA
  blindly), query Feedback table (NEW/REVIEWED, esp. BUG) — **not done
  this session** (no DB/Supabase access available at the point this
  doc was written), cross-check against `docs/design.md` before
  treating anything as open.
- Brief and build stay separate steps for design-fidelity-sensitive
  work — quote exact export values before building. This session
  additionally wrote a real audit doc before each restyle (see
  `docs/organisers-grid-embed-audit.md`) — worth keeping as the pattern
  for future design-fidelity work, not just this once.
- PR workflow: feature branch off fresh `origin/qa` → push → PR → CI
  poll → re-fetch head SHA immediately before squash-merge → delete
  branch → Contents API verify → Vercel READY confirm → runtime errors
  check → Feedback table update. All PRs target `qa`.
- `CodeCounter` has drifted from real max displayId at least twice
  before — worth a quick sanity check each time before using it rather
  than assuming it's in sync (not re-checked this session).
- No GitHub Copilot on this project at all. Only Claude (chat) and
  Claude Code.
- HARD PRODUCTION FREEZE still in effect — no qa→main merges, no prod
  Supabase touches, no Razorpay live keys, until Hitesh's explicit
  "company registered" signal. Company registration is complete, PAN
  received; current account and GST still pending.
