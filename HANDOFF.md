# AFA Handoff — 22 Aug 2026 session

**qa HEAD: `cdffa53a3f1bf3bc1a9b3ea13e9e83e8ded0399f`**
(verify fresh at next session start — do not trust this blindly)

🔴 **Razorpay and Google Maps/Places billing dashboards remain unchecked
across many sessions now, including this one.** First thing to do next
session, before anything else.

---

## Shipped this session (all merged to qa, Vercel READY, zero runtime errors)

1. **PR #516 — BUG-2608-080**: Artists hero rebuilt against the real
   Figma Make export (was screenshot-only approved originally, drifted
   into a centered/boxed layout instead of the export's left-aligned
   grid). Sharp corners, search icon moved to left of input,
   `BrowseSearchDropdown` mechanism untouched. Deliberate deviation: no
   forced `<br/>` in the headline (breaks for locales like Bengali
   where `heroPrefix` is empty).

2. **PR #517 — GEN-2608-078**: Artists hero eyebrow/subtitle
   restructured for cross-page consistency with Events/Venues —
   eyebrow changed from static "The directory" to a stat-forward
   `"{n} artists live now"`, subtitle moved full-width below the
   headline, redundant count removed from the lower stat+search row.
   Deliberately deviates from the export's two-column grid structure.
   Source check (Part 1 of this task) confirmed the export's headline
   itself has no amber/span treatment — correctly concluded not to add
   amber to the headline at that point.

3. **PR #518 — GEN-2608-079**: That "no amber on headline" conclusion
   was explicitly reversed by Hitesh's direct call. Headline collapsed
   to one line (removed a `maxWidth: 560px` that was force-wrapping it
   even without a literal `<br/>`; clamp reduced from
   `(48px,9vw,112px)` to `(48px,8vw,96px)`), and `heroEmphasis`
   ("Artists") colored `var(--afa-amber)` while `heroPrefix`
   ("Discover ") stays plain cream — matching the payoff-word-gets-
   amber convention Events/Venues both use (amber never on the lead
   word). Verified single-line at 390/768/1024/1280/1440px.

4. **PR #519 — BUG-2608-081**: SiteNav's role badge ("Venue Owner" /
   "Artist" / "Organiser" / etc., next to the signed-in greeting) used
   the exact same color as the active nav-link state
   (`var(--afa-terracotta)` on `rgba(200,68,26,0.08)`), creating a
   false affordance — it looked clickable, wasn't. Restyled to a quiet
   badge borrowing structure (not color) from the real Published
   status badge — deliberately NOT reusing that badge's sage/gold,
   since those are semantic to publish-state elsewhere. Fixed via one
   shared `ROLE_BADGE_STYLE` constant, so it covers every role in one
   place.

**Artists hero is now fully done** — three rounds, source-verified,
fully documented decision trail including the explicit GEN-2608-079
override of GEN-2608-078.

### Process note for next session
Two of the four PRs this session (#518, #519) hit the same issue:
Claude Code branched off a feature branch that got merged and deleted
mid-session, leaving the pushed branch with a diverged git graph
against `qa` (harmless in content, but a messy raw diff). Both times
this was fixed by isolating the single real commit and cherry-picking
it onto a fresh branch off current `origin/qa`, then running the
normal PR pipeline. **Ask Claude Code to branch fresh off `qa` at the
start of each new task**, rather than assuming local `qa` is current —
merges are landing mid-session now that the pace has picked up.

---

## Open items, carried forward

1. **GEN-2608-073** — Artist directory cards (real-photo ones) still
   read as "too basic/ordinary." Still NEW. No design direction agreed
   — needs a real conversation with Hitesh before building anything.

2. **Empty-state design gap** — 1,140 approved QA venues, only 22 have
   facilities data, only 1 has a seat map. The sparse view is what 99%
   of real venues will actually show, and it's never been designed —
   the Venues fidelity round used Prithvi Theatre's fully-populated
   mock data throughout. Hitesh hasn't picked a direction: (a) design
   a real sparse/empty state, or (b) treat it as a data problem and
   push owner-side facility/seatmap entry instead.

3. **Owner card city field** — export shows a city row with no backing
   schema/API field. Needs Hitesh's call: add it for real, or rule it
   out of scope.

4. Figma MCP still cannot pull raw source for Figma Make files
   (confirmed failing again this session on the amber source check).
   Claude Code local file reads remain the only workaround. Worth
   flagging to Anthropic at some point.

5. 🔴 Razorpay and Google Maps/Places API billing dashboards —
   unconfirmed across many sessions now, this one included.

---

## New this session — Venue Owner Portal (not started, ready to kick off)

Hitesh shared 6 screenshots of the live Venue Owner dashboard (Your
Venues, Edit Profile, Revenue Overview, Booking Requests calendar,
Flexible Requests, Register Venue form) — flagged as visually the odd
one out on the whole platform: plain white calendar grid, default form
styling, an almost-empty revenue chart, no illustration/duotone
treatment anywhere. Functionally solid, never had a design pass.

**Sequencing note:** memory had "dashboards" queued as a *possible*
future Figma Make round, explicitly *after* the homepage ships and is
seen live. Hitesh chose to move on it now instead — flagged that
change out loud at the time, not blocking, his call to make.

A two-step design brief is written and ready in this conversation's
artifacts (`venue-owner-portal-design-brief.md`):

1. **Step 1 (send to Claude Code first, read-only)**: extract a real
   design-token/pattern reference from the shipped codebase — colors,
   fonts, spacing, existing card/button/badge conventions — so the
   Figma Make prompt is grounded in what's actually real, not guessed.
2. **Step 2**: paste that output into the Figma Make prompt (already
   drafted, covers all 6 screens as one cohesive portal) and run it.

**Not yet sent to Claude Code — this is the next thing to do**, once
the 🔴 billing dashboard check is out of the way.

---

## Still on the horizon (unchanged from prior sessions)

- Port Figma Make designs into the actual codebase (website "AFA
  Website V1" dark editorial bento, mobile "AFA Mobile App" original
  tab) — not started for either.
- Four Rooms icon/typography treatment (GEN-2608-071) — deferred.
- Organiser and Venue Owner landing pages — queued after artist pages
  confirmed (artist pages themselves still mid-fidelity-review per
  GEN-2608-073 above).
- Seat-map remaining open items (architecture already shipped, PRs
  #147–#151, #193) — per-zone price input on Manual Canvas, grid-
  generator vs. draw-it-myself redundancy, cross-level zone pricing
  aggregation bug, no visual layout preview at event creation,
  curved/angled rows + balcony-as-distinct-tier not built, full venue
  snapshot/lock deferred.

---

## Reminders that don't change session to session

- Session-start: verify qa HEAD fresh (don't trust this doc's SHA
  blindly), query Feedback table (NEW/REVIEWED, esp. BUG), cross-check
  against `docs/design.md` before treating anything as open.
- Brief and build stay separate steps for design-fidelity-sensitive
  work — quote exact export values before building.
- PR workflow: feature branch off fresh `origin/qa` → push → PR → CI
  poll → re-fetch head SHA immediately before squash-merge → delete
  branch → Contents API verify → Vercel READY confirm → runtime errors
  check → Feedback table update. All PRs target `qa`.
- `CodeCounter` has drifted from real max displayId at least twice now
  (BUG counter was 5 behind, GEN counter was 4 behind, both corrected
  this session) — worth a quick sanity check each time before using it
  rather than assuming it's in sync.
- No GitHub Copilot on this project at all. Only Claude (chat) and
  Claude Code.
- HARD PRODUCTION FREEZE still in effect — no qa→main merges, no prod
  Supabase touches, no Razorpay live keys, until Hitesh's explicit
  "company registered" signal. Company registration is complete, PAN
  received; current account and GST still pending.
